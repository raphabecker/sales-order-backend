import cds from '@sap/cds';
import type { ProductProps } from '../../models/product.js';
import type { OrderRecord } from '../../models/sales-order-header.js';
import type { OrderRepository } from './protocols.js';

const { SELECT, UPDATE, INSERT } = cds.ql;

// cds.run joins the transaction of the current request through CAP's async context.
export class CapOrderRepository implements OrderRepository {
  async customerExists(id: string): Promise<boolean> {
    return Boolean(await cds.run(SELECT.one.from('sales.Customers').columns('id').where({ id })));
  }

  async findProducts(ids: string[]): Promise<ProductProps[]> {
    return await cds.run(SELECT.from('sales.Products').where({ id: { in: ids } })) as ProductProps[];
  }

  async reserveStock(id: string, quantity: number): Promise<boolean> {
    const changed = await cds.run(UPDATE.entity('sales.Products')
      .set({ stock: { '-=': quantity } }).where({ id, stock: { '>=': quantity } }));
    return changed === 1;
  }

  async findOrder(id: string): Promise<OrderRecord | undefined> {
    const order = await cds.run(SELECT.one.from('sales.SalesOrderHeaders').where({ id })) as OrderRecord | undefined;
    if (order) order.items = await cds.run(SELECT.from('sales.SalesOrderItems').where({ header_id: id })) as OrderRecord['items'];
    return order;
  }

  async claimCancellation(id: string): Promise<boolean> {
    const changed = await cds.run(UPDATE.entity('sales.SalesOrderHeaders')
      .set({ status: 'CANCELLED' }).where({ id, status: 'OPEN' }));
    return changed === 1;
  }

  async restoreStock(id: string, quantity: number): Promise<boolean> {
    const changed = await cds.run(UPDATE.entity('sales.Products')
      .set({ stock: { '+=': quantity } })
      .where({ id, stock: { '<=': 2_147_483_647 - quantity } }));
    return changed === 1;
  }

  async appendLog(order: OrderRecord, event: 'CREATED' | 'CANCELLED', actor: string): Promise<void> {
    // Keep a business snapshot; never serialize the authenticated user or customer PII.
    await cds.run(INSERT.into('sales.SalesOrderLogs').entries({
      id: cds.utils.uuid(), header_id: order.id, event, actor,
      orderData: JSON.stringify({
        id: order.id, status: order.status, currency: order.currency,
        subtotalAmount: order.subtotalAmount, discountAmount: order.discountAmount,
        totalAmount: order.totalAmount, items: order.items,
      }),
    }));
  }
}
