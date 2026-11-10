import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'test/api.test.ts'], {
  stdio: 'inherit', env: { ...process.env, TEST_BUILT: 'true' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
