import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import { startServer, type TestServer } from './helpers/server.js';

interface Result {
  id: string;
  status: string;
  stock: number;
  totalAmount: string;
  value: Array<{ event: string }>;
}

async function request(server: TestServer, path: string, method = 'GET', data?: unknown): Promise<Result> {
  const response = await fetch(server.base + path, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from('admin:admin-local-only').toString('base64'),
      'Content-Type': 'application/json', 'If-Match': '*',
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  assert.ok(response.ok, response.status + ' ' + text);
  return JSON.parse(text) as Result;
}

it('retains orders, stock and audit across restarts without reseeding or repeating cancellation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sales-restart-'));
  const databaseFile = join(directory, 'orders.sqlite');
  let server: TestServer | undefined;
  try {
    server = await startServer({ persistent: true, databaseFile });
    const product = await request(server, '/Products', 'POST', { name: 'Persistent ' + randomUUID(), price: '9.99', stock: 5 });
    const order = await request(server, '/SalesOrderHeaders', 'POST', {
      customers_id: '38373147-201c-4e8d-bef6-165e14070769',
      items: [{ product_id: product.id, quantity: 2 }],
    });
    await server.stop();
    server = await startServer({ persistent: true, databaseFile });
    assert.equal((await request(server, '/Products(' + product.id + ')')).stock, 3);
    assert.equal(Number((await request(server, '/SalesOrderHeaders(' + order.id + ')')).totalAmount), 19.98);
    assert.equal((await request(server, '/SalesOrderLogs?$filter=header_id eq ' + order.id)).value.length, 1);
    const cancel = '/SalesOrderHeaders(' + order.id + ')/MainService.cancel';
    assert.equal((await request(server, cancel, 'POST', {})).status, 'CANCELLED');
    await server.stop();
    server = await startServer({ persistent: true, databaseFile });
    assert.equal((await request(server, cancel, 'POST', {})).status, 'CANCELLED');
    assert.equal((await request(server, '/Products(' + product.id + ')')).stock, 5);
    const logs = await request(server, '/SalesOrderLogs?$filter=header_id eq ' + order.id);
    assert.deepEqual(logs.value.map(log => log.event).sort(), ['CANCELLED', 'CREATED']);
  } finally {
    await server?.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

it('refuses an unsupported existing database schema instead of overwriting it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sales-schema-'));
  const databaseFile = join(directory, 'orders.sqlite');
  type Probe = { pragma(sql: string): unknown; close(): void };
  const Database = createRequire(import.meta.url)('better-sqlite3') as new (file: string) => Probe;
  const probe = new Database(databaseFile);
  probe.pragma('user_version = 999');
  probe.close();
  try {
    await assert.rejects(startServer({ persistent: true, databaseFile }), /Unsupported database schema version 999/);
    const unchanged = new Database(databaseFile);
    try { assert.deepEqual(unchanged.pragma('user_version'), [{ user_version: 999 }]); }
    finally { unchanged.close(); }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
