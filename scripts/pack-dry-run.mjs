import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = path.join(os.tmpdir(), 'bst-npm-cache');
const logsDir = path.join(os.tmpdir(), 'bst-npm-logs');

await mkdir(cacheDir, { recursive: true });
await mkdir(logsDir, { recursive: true });

const packOutput = execFileSync('npm', ['pack', '--json', '--dry-run'], {
  cwd: rootDir,
  encoding: 'utf8',
  env: {
    ...process.env,
    npm_config_cache: cacheDir,
    npm_config_logs_dir: logsDir
  },
  stdio: ['ignore', 'pipe', 'inherit']
});

const packResult = JSON.parse(packOutput);
const files = Array.isArray(packResult) ? packResult[0]?.files ?? [] : [];
const sourceMaps = files.filter((file) => typeof file.path === 'string' && file.path.endsWith('.map'));

if (sourceMaps.length > 0) {
  throw new Error(`Pack dry-run still includes sourcemaps: ${sourceMaps.map((file) => file.path).join(', ')}`);
}

console.log(JSON.stringify(packResult, null, 2));
