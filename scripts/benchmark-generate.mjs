import { cp, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { generateProject } from '../src/core/generate-project';
import { createLogger } from '../src/utils/log';

const FIXTURES = ['basic', 'multi'];
const ITERATIONS = 5;
const rootDir = process.cwd();
const logger = createLogger(false);

for (const fixture of FIXTURES) {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'bst-bench-'));

  try {
    await cp(path.join(rootDir, 'test/fixtures', fixture), tempDirectory, { recursive: true });

    const configPath = path.join(tempDirectory, 'api.swagger-types.ts');
    const times = [];

    for (let index = 0; index < ITERATIONS; index += 1) {
      const startedAt = performance.now();
      await generateProject({ config: configPath, cache: true }, logger);
      times.push(performance.now() - startedAt);
    }

    const total = times.reduce((sum, value) => sum + value, 0);
    console.log(
      JSON.stringify({
        fixture,
        iterations: ITERATIONS,
        timesMs: times.map((value) => Number(value.toFixed(2))),
        avgMs: Number((total / ITERATIONS).toFixed(2)),
        firstMs: Number(times[0].toFixed(2)),
        warmMs: Number(times.at(-1)?.toFixed(2) ?? '0')
      })
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
