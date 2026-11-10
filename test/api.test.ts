import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { ProductProps } from '../srv/models/product.js';
import type { OrderRecord } from '../srv/models/sales-order-header.js';
import { startServer, type TestServer } from './helpers/server.js';

type User = 'admin' | 'sales' | 'reader' | 'unknown' | null;
interface Collection<T> { value: T[] }
interface Log { id: string; header_id: string; event: string; actor: string; orderData: string }
let server: TestServer;
let base: string;
const customer = '38373147-201c-4e8d-bef6-165e14070769';

before(async () => {
  server = await startServer();
  base = server.base;
});

after(async () => {
  await server?.stop();
});

async function http<T = Record<string, unknown>>(
  path: string, method = 'GET', data?: unknown, user: User = 'admin', extraHeaders = {},
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (user) headers.Authorization = 'Basic ' + Buffer.from(user + ':' + user + '-local-only').toString('base64');
  const response = await fetch(base + path, {
    method, headers, body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let body: T;
  try { body = JSON.parse(text) as T; } catch { body = {} as T; }
  return { status: response.status, body, text, headers: response.headers };
}

function status(actual: { status: number; text: string }, expected: number) {
  assert.equal(actual.status, expected, actual.text);
}

async function product(stock = 10, price = '10.00') {
  const response = await http<ProductProps>('/Products', 'POST', { name: 'Fixture ' + randomUUID(), stock, price });
  status(response, 201);
  return response.body;
}

async function order(productId: string, quantity = 1, extra = {}) {
  return http<OrderRecord>('/SalesOrderHeaders', 'POST', {
    customers_id: customer, items: [{ product_id: productId, quantity }], ...extra,
  }, 'sales');
}

async function stock(id: string) {
  const response = await http<ProductProps>('/Products(' + id + ')');
  status(response, 200);
  return response.body.stock;
}

describe('authentication and authorization over HTTP', () => {
  it('requires authentication and rejects unknown users', async () => {
    status(await http('/Customers', 'GET', undefined, null), 401);
    status(await http('/Customers', 'GET', undefined, 'unknown'), 401);
    const wrong = await fetch(base + '/Customers', {
      headers: { Authorization: 'Basic ' + Buffer.from('reader:wrong').toString('base64') },
    });
    assert.equal(wrong.status, 401);
  });

  it('allows all three roles to read while restricting master-data writes', async () => {
    for (const user of ['admin', 'sales', 'reader'] as const) {
      status(await http('/Customers', 'GET', undefined, user), 200);
      status(await http('/Products', 'GET', undefined, user), 200);
    }
    for (const user of ['sales', 'reader'] as const) {
      status(await http('/Products', 'POST', { name: 'Forbidden', price: '1.00', stock: 1 }, user), 403);
      status(await http('/Customers', 'POST', { firstName: 'A', lastName: 'B', email: 'a@example.com' }, user), 403);
    }
    status(await http('/SalesOrderHeaders', 'POST', { customers_id: customer, items: [] }, 'reader'), 403);
  });

  it('protects audit reads and keeps audit entries immutable even for admin', async () => {
    status(await http('/SalesOrderLogs', 'GET', undefined, 'sales'), 403);
    status(await http('/SalesOrderLogs', 'GET', undefined, 'reader'), 403);
    status(await http('/SalesOrderLogs', 'POST', { event: 'FAKE' }), 405);
  });
});

describe('catalog and customers', () => {
  it('normalizes customer data and supports single-record and projected reads', async () => {
    const email = randomUUID() + '@example.com';
    const created = await http<{ id: string; email: string; firstName: string }>('/Customers', 'POST', {
      firstName: ' Ana ', lastName: ' Silva ', email: ' ' + email.toUpperCase() + ' ',
    });
    status(created, 201);
    assert.equal(created.body.firstName, 'Ana');
    assert.equal(created.body.email, email);
    const single = await http('/Customers(' + created.body.id + ')?$select=id,firstName');
    status(single, 200);
    assert.equal(single.body.firstName, 'Ana');
    assert.equal('email' in single.body, false);
    const updated = await http('/Customers(' + created.body.id + ')', 'PATCH',
      { lastName: ' Souza ' }, 'admin', { 'If-Match': '*' });
    status(updated, 200);
    status(await http('/Customers', 'POST', { firstName: 'A', lastName: 'B', email: email.toUpperCase() }), 409);
  });

  it('rejects invalid master data', async () => {
    for (const data of [{ name: ' ', stock: 1, price: '1.00' }, { name: 'P', stock: -1, price: '1.00' },
      { name: 'P', stock: 1, price: '-1.00' }, { name: 'P', stock: 1, price: '1.001' }]) {
      status(await http('/Products', 'POST', data), 400);
    }
    status(await http('/Customers', 'POST', { firstName: 'A', lastName: 'B', email: 'invalid' }), 400);
  });

  it('rejects stale catalog updates using ETags', async () => {
    const p = await product();
    status(await http('/Products(' + p.id + ')', 'PATCH', { name: 'Changed' }, 'admin',
      { 'If-Match': 'W/"2000-01-01T00:00:00.000Z"' }), 412);
  });

  it('supports OData filtering, paging, ordering and count', async () => {
    const response = await http<Collection<ProductProps>>('/Products?$filter=stock gt 0&$orderby=name&$top=2&$count=true');
    status(response, 200);
    assert.equal(response.body.value.length, 2);
    assert.ok(response.body.value.every(p => p.stock > 0));
  });
});

describe('transactional sales orders', () => {
  it('prices from the catalog, ignores forged totals and reserves stock', async () => {
    const p = await product(10, '0.10');
    const response = await order(p.id, 3, {
      totalAmount: '0.01', subtotalAmount: '0.01', discountAmount: '99.99',
      status: 'CANCELLED', currency: 'USD', createdBy: 'forged-user', modifiedBy: 'forged-user',
      items: [{ product_id: p.id, quantity: 3, price: '9999.00', header_id: randomUUID() }],
    });
    status(response, 201);
    assert.equal(Number(response.body.totalAmount), 0.3);
    assert.equal(Number(response.body.items[0]!.price), 0.1);
    assert.equal(response.body.currency, 'BRL');
    assert.equal(response.body.status, 'OPEN');
    assert.equal((response.body as OrderRecord & { createdBy: string }).createdBy, 'sales');
    assert.equal(await stock(p.id), 7);
    const expanded = await http<OrderRecord>('/SalesOrderHeaders(' + response.body.id + ')?$expand=items,customers');
    status(expanded, 200);
    assert.equal(expanded.body.items.length, 1);
    const logs = await http<Collection<Log>>('/SalesOrderLogs?$filter=header_id eq ' + response.body.id);
    assert.equal(logs.body.value.length, 1);
    assert.equal(logs.body.value[0]!.actor, 'sales');
    assert.equal(logs.body.value[0]!.event, 'CREATED');
    assert.ok(!logs.body.value[0]!.orderData.includes('@example.com'));
    assert.ok(!logs.body.value[0]!.orderData.includes('password'));
  });

  it('applies the discount at the specified threshold', async () => {
    const p = await product(10, '7500.00');
    const atThreshold = await order(p.id, 4);
    status(atThreshold, 201);
    assert.equal(Number(atThreshold.body.discountAmount), 0);
    const above = await order(p.id, 5);
    status(above, 201);
    assert.equal(Number(above.body.subtotalAmount), 37500);
    assert.equal(Number(above.body.discountAmount), 3750);
    assert.equal(Number(above.body.totalAmount), 33750);
  });

  it('rejects missing references, invalid quantities, duplicates and empty items', async () => {
    const p = await product();
    const cases: Array<[unknown, number]> = [
      [{ items: [{ product_id: p.id, quantity: 1 }] }, 400],
      [{ customers_id: randomUUID(), items: [{ product_id: p.id, quantity: 1 }] }, 404],
      [{ customers_id: customer, items: [{ product_id: randomUUID(), quantity: 1 }] }, 404],
      [{ customers_id: customer, items: [] }, 400],
      [{ customers_id: customer, items: null }, 400],
      [{ customers_id: customer }, 400],
      [{ customers_id: customer, customers: { firstName: 'Forged' }, items: [{ product_id: p.id, quantity: 1 }] }, 400],
      [{ customers_id: customer, items: [{ product_id: p.id, quantity: 0 }] }, 400],
      [{ customers_id: customer, items: [{ product_id: p.id, quantity: -1 }] }, 400],
      [{ customers_id: customer, items: [{ product_id: p.id, quantity: 1.5 }] }, 400],
      [{ customers_id: customer, items: [{ product_id: p.id, quantity: 1 }, { product_id: p.id, quantity: 1 }] }, 400],
    ];
    for (const [body, expected] of cases) status(await http('/SalesOrderHeaders', 'POST', body, 'sales'), expected);
    assert.equal(await stock(p.id), 10);
  });

  it('leaves all inventory unchanged when a multi-item order is rejected', async () => {
    const first = await product(10);
    const second = await product(0);
    status(await order(first.id, 2, { items: [
      { product_id: first.id, quantity: 2 }, { product_id: second.id, quantity: 1 },
    ] }), 409);
    assert.equal(await stock(first.id), 10);
    assert.equal(await stock(second.id), 0);
  });

  it('rolls stock and audit back when insertion fails after reservation', async () => {
    const p = await product(10);
    const first = await order(p.id);
    status(first, 201);
    status(await order(p.id, 2, { id: first.body.id }), 409);
    assert.equal(await stock(p.id), 9);
    const logs = await http<Collection<Log>>('/SalesOrderLogs?$filter=header_id eq ' + first.body.id);
    assert.equal(logs.body.value.length, 1);
  });

  it('prevents overselling when two requests compete for the last unit', async () => {
    const p = await product(1);
    const responses = await Promise.all([order(p.id), order(p.id)]);
    assert.deepEqual(responses.map(r => r.status).sort(), [201, 409], responses.map(r => r.text).join('\n'));
    assert.equal(await stock(p.id), 0);
  });

  it('cancels concurrently and restores inventory exactly once with one audit event', async () => {
    const p = await product(10);
    const created = await order(p.id, 3);
    status(created, 201);
    const path = '/SalesOrderHeaders(' + created.body.id + ')/MainService.cancel';
    status(await http(path, 'POST', {}, 'reader'), 403);
    const responses = await Promise.all([
      http<OrderRecord>(path, 'POST', {}, 'sales', { 'If-Match': '*' }),
      http<OrderRecord>(path, 'POST', {}, 'sales', { 'If-Match': '*' }),
    ]);
    responses.forEach(r => { status(r, 200); assert.equal(r.body.status, 'CANCELLED'); });
    assert.equal(await stock(p.id), 10);
    status(await http(path, 'POST', {}, 'sales', { 'If-Match': '*' }), 200);
    assert.equal(await stock(p.id), 10);
    const logs = await http<Collection<Log>>('/SalesOrderLogs?$filter=header_id eq ' + created.body.id);
    assert.deepEqual(logs.body.value.map(log => log.event).sort(), ['CANCELLED', 'CREATED']);
  });

  it('rejects cancelling an unknown order', async () => {
    status(await http('/SalesOrderHeaders(' + randomUUID() + ')/MainService.cancel', 'POST', {}, 'sales', { 'If-Match': '*' }), 404);
  });

  it('requires an explicit cancellation precondition and rejects stale versions', async () => {
    const p = await product();
    const created = await order(p.id);
    status(created, 201);
    const path = '/SalesOrderHeaders(' + created.body.id + ')/MainService.cancel';
    status(await http(path, 'POST', {}, 'sales'), 428);
    status(await http(path, 'POST', {}, 'sales', { 'If-Match': 'W/"2000-01-01T00:00:00.000Z"' }), 412);
    assert.equal(await stock(p.id), 9);
  });

  it('rolls cancellation back when inventory cannot be restored', async () => {
    const p = await product(10);
    const created = await order(p.id, 3);
    status(created, 201);
    status(await http('/Products(' + p.id + ')', 'PATCH', { stock: 2_147_483_647 }, 'admin', { 'If-Match': '*' }), 200);
    status(await http('/SalesOrderHeaders(' + created.body.id + ')/MainService.cancel', 'POST', {}, 'sales', { 'If-Match': '*' }), 409);
    const current = await http<OrderRecord>('/SalesOrderHeaders(' + created.body.id + ')');
    assert.equal(current.body.status, 'OPEN');
    assert.equal(await stock(p.id), 2_147_483_647);
    const logs = await http<Collection<Log>>('/SalesOrderLogs?$filter=header_id eq ' + created.body.id);
    assert.deepEqual(logs.body.value.map(log => log.event), ['CREATED']);
  });

  it('prevents direct order/item mutation and deletion of referenced master data', async () => {
    const p = await product();
    const created = await order(p.id);
    status(created, 201);
    const id = created.body.id;
    const itemId = created.body.items[0]!.id!;
    status(await http('/SalesOrderHeaders(' + id + ')', 'PATCH', { totalAmount: 0 }), 403);
    status(await http('/SalesOrderHeaders(' + id + ')', 'DELETE'), 403);
    status(await http('/SalesOrderItems(' + itemId + ')', 'PATCH', { quantity: 100 }), 403);
    status(await http('/SalesOrderItems', 'POST', { header_id: id, product_id: p.id, quantity: 1 }), 403);
    status(await http('/SalesOrderHeaders(' + id + ')/items(' + itemId + ')', 'DELETE'), 403);
    status(await http('/Products(' + p.id + ')', 'DELETE', undefined, 'admin', { 'If-Match': '*' }), 409);
    status(await http('/Customers(' + customer + ')', 'DELETE', undefined, 'admin', { 'If-Match': '*' }), 409);
  });
});
