import path from 'node:path';

import { DEFAULT_CONFIG_FILE } from '../core/constants';
import type { InitOptions, Logger } from '../types/internal';
import { pathExists, writeIfChanged } from '../utils/fs';
import { detectPackageManager, packageManagerExec } from '../utils/package-manager';

export async function runInit(options: InitOptions, logger: Logger): Promise<void> {
  const configPath = path.resolve(process.cwd(), options.configPath || DEFAULT_CONFIG_FILE);

  if ((await pathExists(configPath)) && !options.force) {
    throw new Error(`Config already exists at ${configPath}. Re-run with --force to overwrite it.`);
  }

  await writeIfChanged(configPath, buildTemplate());

  const packageManager = await detectPackageManager(process.cwd());
  const execCommand = packageManagerExec(packageManager);

  logger.info(`Created ${path.relative(process.cwd(), configPath) || DEFAULT_CONFIG_FILE}`);
  logger.info('Suggested script:');
  logger.info('  "swagger:types": "better-swagger-types generate"');
  logger.info('Run next:');
  logger.info(`  ${execCommand} better-swagger-types generate`);
}

function buildTemplate(): string {
  return `/**
 * better-swagger-types config
 *
 * This file ONLY points at OpenAPI/Swagger schema sources (local files, directories, globs, or URLs).
 * It does NOT contain the schema definitions themselves.
 *
 * After editing, run:
 *   npx better-swagger-types generate
 */
import { defineConfig } from 'better-swagger-types/config';

export default defineConfig({
  // Where generated TypeScript files will be written.
  output: 'lib/generated',

  // Optional Prisma-style marker output in node_modules/.better-swagger-types.
  // Default: false.
  prismaStyleNodeModulesOutput: false,

  // Add one entry per API schema source.
  schemas: [
    {
      // Friendly name for the schema. Used as the base for folder naming.
      name: 'core',

      // Source can be a JSON file, a directory, a glob, or an HTTP(S) URL.
      source: './schemas/core.json',

      // Optional headers for remote fetches.
      headers: {
        Authorization: \`Bearer \${process.env.API_TOKEN ?? ''}\`
      },

      // Optional explicit format. Default: auto.
      format: 'auto',

      // Optional TypeScript namespace. Default: PascalCase(name).
      namespace: 'Core'
    }
  ],

  generator: {
    // Emit operation-level ergonomic mappings. Default: true.
    emitOperations: true,

    // Emit schema component aliases. Default: true.
    emitSchemas: true,

    // Emit simple path-derived aliases like UsersByIdAPI. Default: false.
    emitSimpleAliases: false,

    // Resolve refs through validation/bundling. Default: true.
    resolveRefs: true,

    // Stable deterministic naming. Default: 'stable'.
    naming: 'stable'
  }
});
`;
}
