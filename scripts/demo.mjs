import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = 'http://127.0.0.1:' + (process.env.PORT ?? '4004') + '/odata/v4/main';
async function request(path, method = 'GET', data, user = 'sales') {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(user + ':' + user + '-local-only').toString('base64'),
      'Content-Type': 'application/json',
      'If-Match': '*',
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(response.status + ' ' + text);
  return JSON.parse(text);
}

try {
  const product = await request('/Products', 'POST', {
    name: 'Demo USB-C Dock ' + randomUUID().slice(0, 8), price: '299.90', stock: 10,
  }, 'admin');
  const order = await request('/SalesOrderHeaders', 'POST', {
    customers_id: '38373147-201c-4e8d-bef6-165e14070769',
    items: [{ product_id: product.id, quantity: 2 }],
  });
  assert.equal(Number(order.totalAmount), 599.8);
  assert.equal((await request('/Products(' + product.id + ')')).stock, 8);
  console.log('Created order ' + order.id + ': BRL ' + order.totalAmount + '; stock 10 → 8');
  const cancelled = await request('/SalesOrderHeaders(' + order.id + ')/MainService.cancel', 'POST', {});
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal((await request('/Products(' + product.id + ')')).stock, 10);
  const logs = await request('/SalesOrderLogs?$filter=header_id eq ' + order.id, 'GET', undefined, 'admin');
  assert.deepEqual(logs.value.map(log => log.event).sort(), ['CANCELLED', 'CREATED']);
  console.log('Cancelled order; stock 8 → 10; verified CREATED and CANCELLED audit events');
} catch (error) {
  console.error('Demo failed. Start the API with npm run dev first.');
  console.error(error.message);
  process.exitCode = 1;
}
