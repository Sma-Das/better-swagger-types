#!/usr/bin/env node
import { cac } from 'cac';

import { runClean } from './commands/clean';
import { runDev } from './commands/dev';
import { runGenerate } from './commands/generate';
import { runInit } from './commands/init';
import { DEFAULT_CONFIG_FILE } from './core/constants';
import { createLogger } from './utils/log';
import pkg from '../package.json';

const cli = cac('better-swagger-types');

cli.version(pkg.version);
cli.help();
cli.option('--init', 'Create the default config file');
cli.option('--config <path>', `Path to the config file (default: ${DEFAULT_CONFIG_FILE})`);
cli.option('--verbose', 'Enable verbose logging');
cli.option('--no-cache', 'Disable remote schema cache for this run');

cli
  .command('init', 'Create api.swagger-types.ts in the current project')
  .option('--config <path>', `Path to the config file (default: ${DEFAULT_CONFIG_FILE})`)
  .option('--force', 'Overwrite an existing config file')
  .option('--verbose', 'Enable verbose logging')
  .action(async (options) => {
    const logger = createLogger(Boolean(options.verbose));
    await runInit(
      {
        configPath: options.config ?? DEFAULT_CONFIG_FILE,
        force: Boolean(options.force)
      },
      logger
    );
  });

cli
  .command('generate', 'Generate TypeScript files from configured schemas')
  .option('--config <path>', `Path to the config file (default: ${DEFAULT_CONFIG_FILE})`)
  .option('--verbose', 'Enable verbose logging')
  .option('--no-cache', 'Disable remote schema cache for this run')
  .action(async (options) => {
    const logger = createLogger(Boolean(options.verbose));
    await runGenerate(
      {
        config: options.config,
        verbose: Boolean(options.verbose),
        cache: options.cache
      },
      logger
    );
  });

cli
  .command('dev', 'Watch local schema files and regenerate on change')
  .option('--config <path>', `Path to the config file (default: ${DEFAULT_CONFIG_FILE})`)
  .option('--verbose', 'Enable verbose logging')
  .option('--no-cache', 'Disable remote schema cache for this run')
  .action(async (options) => {
    const logger = createLogger(Boolean(options.verbose));
    await runDev(
      {
        config: options.config,
        verbose: Boolean(options.verbose),
        cache: options.cache
      },
      logger
    );
  });

cli
  .command('clean', 'Remove generated files and internal cache state')
  .option('--config <path>', `Path to the config file (default: ${DEFAULT_CONFIG_FILE})`)
  .option('--verbose', 'Enable verbose logging')
  .action(async (options) => {
    const logger = createLogger(Boolean(options.verbose));
    await runClean(
      {
        config: options.config,
        verbose: Boolean(options.verbose)
      },
      logger
    );
  });

async function main(): Promise<void> {
  cli.parse();

  if (cli.options.init) {
    const logger = createLogger(Boolean(cli.options.verbose));
    await runInit(
      {
        configPath: (cli.options.config as string | undefined) ?? DEFAULT_CONFIG_FILE,
        force: false
      },
      logger
    );
    return;
  }

  if (!cli.matchedCommand) {
    if (cli.args.length > 0) {
      throw new Error(`Unknown command: ${cli.args[0]}`);
    }

    const logger = createLogger(Boolean(cli.options.verbose));
    await runGenerate(
      {
        config: cli.options.config as string | undefined,
        verbose: Boolean(cli.options.verbose),
        cache: cli.options.cache as boolean | undefined
      },
      logger
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
