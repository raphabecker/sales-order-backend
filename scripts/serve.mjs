import { fileURLToPath } from 'node:url';

const persistent = process.argv.includes('--persistent');
const local = process.env.NODE_ENV !== 'production';
if (persistent && !local) throw new Error('The persistent local profile is for local development only. Configure production storage and identity separately.');
let database;
if (persistent) {
  const { prepareDatabase } = await import('./persistence.mjs');
  database = await prepareDatabase(fileURLToPath(new URL('../', import.meta.url)));
}
if (process.argv.includes('--built')) {
  process.chdir(fileURLToPath(new URL('../dist/', import.meta.url)));
} else {
  process.env.CDS_TYPESCRIPT = 'true';
}
const { default: cds } = await import('@sap/cds');
const port = Number(process.env.PORT ?? 4004);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be between 0 and 65535');
if (persistent) {
  cds.on('served', async () => {
    if (database.initialize) await cds.db.run('PRAGMA user_version = ' + database.version);
  });
}
const server = await cds.server({
  port: { port, host: local ? '127.0.0.1' : '0.0.0.0' },
  in_memory: local && (!persistent || database.initialize),
});
const report = () => {
  if (persistent) console.log('Persistent SQLite database: ' + database.file);
  console.log('Sales Order API listening at http://' + (local ? '127.0.0.1' : '0.0.0.0') + ':' + server.address().port);
};
if (server.listening) report();
else server.once('listening', report);
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(async () => {
    await cds.disconnect();
    process.exit(0);
  }));
}
