import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';

export const SCHEMA_VERSION = 2;

export async function prepareDatabase(projectRoot) {
  const file = resolve(process.env.SALES_DB_FILE ?? resolve(projectRoot, '.data/sales.sqlite'));
  await mkdir(dirname(file), { recursive: true });
  const existed = existsSync(file);
  const probe = new Database(file);
  let initialize;
  try {
    const version = probe.pragma('user_version', { simple: true });
    const tables = probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
    initialize = !existed || (version === 0 && tables.length === 0);
    if (!initialize && version !== SCHEMA_VERSION) {
      throw new Error('Unsupported database schema version ' + version + '. Back up the database and apply a reviewed migration; existing data will not be overwritten.');
    }
    const expected = ['sales_Customers', 'sales_Products', 'sales_SalesOrderHeaders', 'sales_SalesOrderItems', 'sales_SalesOrderLogs'];
    if (!initialize && !expected.every(name => tables.some(table => table.name === name))) {
      throw new Error('Database schema is incomplete; existing data will not be overwritten.');
    }
  } finally {
    probe.close();
  }
  process.env.CDS_REQUIRES_DB_DRIVER = 'better-sqlite3';
  process.env.CDS_REQUIRES_DB_CREDENTIALS_URL = file;
  return { file, initialize, version: SCHEMA_VERSION };
}
