import cds from '@sap/cds';
import type { Request, Service } from '@sap/cds';
import { customerController } from './factories/Controllers/customer.js';
import { DomainError } from './models/errors.js';
import { formatMoney, toCents } from './models/money.js';
import type { OrderRecord } from './models/sales-order-header.js';
import { CapOrderRepository } from './repositories/orders/implementation.js';
import { OrderService } from './services/orders/implementation.js';

const { SELECT } = cds.ql;

async function handle<T>(request: Request, operation: () => T | Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DomainError) return request.reject(error.status, error.message, error.target);
    throw error;
  }
}

export default (service: Service) => {
  const orders = new OrderService(new CapOrderRepository());

  service.on('error', error => {
    // The WASM SQLite driver reports uniqueness failures without a driver error code.
    if (/^UNIQUE constraint failed:/.test(error.message)) {
      Object.assign(error, {
        code: 'UNIQUE_CONFLICT', status: 409, statusCode: 409,
        message: 'A record with these unique fields already exists',
      });
    }
  });

  service.before(['CREATE', 'UPDATE'], 'Customers', request => handle(request, () => {
    Object.assign(request.data, customerController.beforeWrite(request.data));
  }));

  service.before(['CREATE', 'UPDATE'], 'Products', request => handle(request, () => {
    const data = request.data;
    if ('name' in data) {
      if (typeof data.name !== 'string' || !data.name.trim()) throw new DomainError(400, 'Product name is required', 'name');
      data.name = data.name.trim();
    }
    if ('price' in data) data.price = formatMoney(toCents(data.price));
    if ('stock' in data && (!Number.isInteger(data.stock) || data.stock < 0 || data.stock > 2_147_483_647)) {
      throw new DomainError(400, 'Stock must be a non-negative 32-bit integer', 'stock');
    }
  }));

  for (const [entity, table, foreignKey] of [
    ['Customers', 'sales.SalesOrderHeaders', 'customers_id'],
    ['Products', 'sales.SalesOrderItems', 'product_id'],
  ]) {
    service.before('DELETE', entity!, request => handle(request, async () => {
      const id = (request.params[0] as { id: string }).id;
      const used = await cds.run(SELECT.one.from(table!).columns('id').where({ [foreignKey!]: id }));
      if (used) throw new DomainError(409, 'Referenced records cannot be deleted');
    }));
  }

  service.before('CREATE', 'SalesOrderHeaders', request => handle(request, async () => {
    if ('customers' in request.data) {
      throw new DomainError(400, 'Use customers_id to reference an existing customer', 'customers');
    }
    const priced = await orders.prepareCreation(request.data);
    request.data.id ??= cds.utils.uuid();
    Object.assign(request.data, priced);
    // Discard client-supplied header links and use only validated item fields.
    request.data.items = priced.items.map(item => ({ ...item, id: item.id ?? cds.utils.uuid() }));
  }));

  service.after('CREATE', 'SalesOrderHeaders', (_result: unknown, request: Request) => handle(request, async () => {
    await orders.recordCreation(request.data as OrderRecord, request.user.id);
  }));

  service.on('cancel', 'SalesOrderHeaders', request => handle(request, async () => {
    const id = (request.params[0] as { id: string }).id;
    return orders.cancel(id, request.user.id);
  }));
};
