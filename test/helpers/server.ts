import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface TestServer {
  base: string;
  stop(): Promise<void>;
}

export async function startServer(options: { persistent?: boolean; databaseFile?: string } = {}): Promise<TestServer> {
  const persistent = options.persistent ?? process.env.TEST_PERSISTENT === 'true';
  const directory = persistent && !options.databaseFile ? await mkdtemp(join(tmpdir(), 'sales-api-')) : undefined;
  const databaseFile = options.databaseFile ?? (directory ? join(directory, 'orders.sqlite') : undefined);
  const args = process.env.TEST_BUILT ? ['scripts/serve.mjs', '--built'] : ['--import', 'tsx', 'scripts/serve.mjs'];
  if (persistent) args.push('--persistent');
  let child: ChildProcess | undefined;
  let output = '';
  const stop = async () => {
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    if (directory) await rm(directory, { recursive: true, force: true });
  };
  try {
    child = spawn(process.execPath, args, {
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      env: {
        ...process.env, PORT: '0', NODE_ENV: 'development',
        ...(databaseFile ? { SALES_DB_FILE: databaseFile } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const base = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('API startup timed out:\n' + output)), 25_000);
      const read = (chunk: Buffer) => {
        output += chunk.toString();
        const match = output.match(/Sales Order API listening at (http:\/\/127\.0\.0\.1:\d+)/);
        if (match) { clearTimeout(timer); resolve(match[1]! + '/odata/v4/main'); }
      };
      child!.stdout!.on('data', read);
      child!.stderr!.on('data', read);
      child!.once('error', error => { clearTimeout(timer); reject(error); });
      child!.once('exit', code => {
        clearTimeout(timer);
        reject(new Error('API exited with code ' + code + ':\n' + output));
      });
    });
    return { base, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
