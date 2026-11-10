import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', 'test/api.test.ts', 'test/persistence.test.ts'], {
  stdio: 'inherit', env: { ...process.env, TEST_BUILT: 'true', TEST_PERSISTENT: 'true' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
