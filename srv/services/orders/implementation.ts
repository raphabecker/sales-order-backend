import { DomainError } from '../../models/errors.js';
import { SalesOrderHeaderModel } from '../../models/sales-order-header.js';
import type { OrderInput, OrderRecord } from '../../models/sales-order-header.js';
import { validateItems } from '../../models/sales-order-item.js';
import type { OrderRepository } from '../../repositories/orders/protocols.js';

export class OrderService {
  constructor(private readonly repository: OrderRepository) {}

  async prepareCreation(input: OrderInput) {
    if (!input.customers_id) throw new DomainError(400, 'A customer is required', 'customers_id');
    const items = validateItems(input.items);
    if (!await this.repository.customerExists(input.customers_id)) {
      throw new DomainError(404, 'Customer not found', 'customers_id');
    }
    const products = await this.repository.findProducts(items.map(item => item.product_id));
    const priced = SalesOrderHeaderModel.price(input, products);
    // All orders acquire stock in a stable sequence to reduce deadlocks.
    for (const item of [...priced.items].sort((a, b) => a.product_id.localeCompare(b.product_id))) {
      if (!await this.repository.reserveStock(item.product_id, item.quantity)) {
        throw new DomainError(409, 'Stock changed while creating the order; retry with current quantities', 'items');
      }
    }
    return priced;
  }

  async recordCreation(order: OrderRecord, actor: string): Promise<void> {
    await this.repository.appendLog(order, 'CREATED', actor);
  }

  async cancel(id: string, actor: string): Promise<OrderRecord> {
    const order = await this.repository.findOrder(id);
    if (!order) throw new DomainError(404, 'Order not found');
    if (order.status === 'CANCELLED') return order;
    if (!await this.repository.claimCancellation(id)) {
      const current = await this.repository.findOrder(id);
      if (current?.status === 'CANCELLED') return current;
      throw new DomainError(409, 'Order changed while cancelling; retry');
    }
    for (const item of [...order.items].sort((a, b) => a.product_id.localeCompare(b.product_id))) {
      if (!await this.repository.restoreStock(item.product_id, item.quantity)) {
        throw new DomainError(409, 'Stock cannot be restored; cancellation rolled back');
      }
    }
    const cancelled = await this.repository.findOrder(id);
    if (!cancelled) throw new DomainError(409, 'Order changed while cancelling; retry');
    await this.repository.appendLog(cancelled, 'CANCELLED', actor);
    return cancelled;
  }
}
