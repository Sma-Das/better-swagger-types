import { execFileSync } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packDir = await mkdtemp(path.join(os.tmpdir(), 'bst-pack-'));
const smokeDir = await mkdtemp(path.join(os.tmpdir(), 'bst-smoke-'));
const npmCacheDir = path.join(os.tmpdir(), 'bst-npm-cache');
const npmLogsDir = path.join(os.tmpdir(), 'bst-npm-logs');
const bunCacheDir = path.join(os.tmpdir(), 'bst-bun-cache');

await mkdir(npmCacheDir, { recursive: true });
await mkdir(npmLogsDir, { recursive: true });
await mkdir(bunCacheDir, { recursive: true });

const npmEnv = {
  ...process.env,
  npm_config_cache: npmCacheDir,
  npm_config_logs_dir: npmLogsDir
};
const bunEnv = {
  ...process.env,
  TMPDIR: smokeDir,
  BUN_INSTALL_CACHE_DIR: bunCacheDir
};

try {
  const packOutput = execFileSync('npm', ['pack', '--json', '--pack-destination', packDir], {
    cwd: rootDir,
    encoding: 'utf8',
    env: npmEnv,
    stdio: ['ignore', 'pipe', 'inherit']
  });
  const packResult = JSON.parse(packOutput);
  const packedName = packResult[0]?.filename;

  if (typeof packedName !== 'string' || packedName.length === 0) {
    throw new Error('Failed to determine packed tarball name.');
  }

  await writeFile(
    path.join(smokeDir, 'package.json'),
    `${JSON.stringify({ name: 'bst-smoke', private: true, type: 'module' }, null, 2)}\n`,
    'utf8'
  );
  await mkdir(path.join(smokeDir, 'schemas'), { recursive: true });
  await cp(path.join(rootDir, 'examples', 'petstore.json'), path.join(smokeDir, 'schemas', 'core.json'));
  await writeFile(
    path.join(smokeDir, 'api.swagger-types.ts'),
    `export default {
  output: 'lib/generated',
  prismaStyleNodeModulesOutput: false,
  schemas: [
    {
      name: 'core',
      source: './schemas/core.json',
      namespace: 'Core',
      format: 'auto'
    }
  ],
  generator: {
    emitOperations: true,
    emitSchemas: true,
    resolveRefs: true,
    naming: 'stable'
  }
};
`,
    'utf8'
  );

  execFileSync('bun', ['add', 'ajv@6.14.0'], {
    cwd: smokeDir,
    env: bunEnv,
    stdio: 'inherit'
  });
  execFileSync('bun', ['add', path.join(packDir, packedName)], {
    cwd: smokeDir,
    env: bunEnv,
    stdio: 'inherit'
  });
  execFileSync('npx', ['better-swagger-types', 'generate'], {
    cwd: smokeDir,
    stdio: 'inherit'
  });

  await access(path.join(smokeDir, 'lib', 'generated', 'index.ts'));
  console.log('Packaged CLI smoke test passed.');
} finally {
  await rm(packDir, { recursive: true, force: true });
  await rm(smokeDir, { recursive: true, force: true });
}
