import { cp, mkdir, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
for (const entry of ['db', 'test/data', '.cdsrc.json']) {
  await cp(entry, 'dist/' + entry, { recursive: true });
}
await cp('srv/main.cds', 'dist/srv/main.cds');
await writeFile('dist/package.json', JSON.stringify({ type: 'module', private: true }, null, 2) + '\n');
console.log('Compiled service and models written to dist/');
