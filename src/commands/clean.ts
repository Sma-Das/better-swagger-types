import path from 'node:path';

import { CACHE_DIR, MANIFEST_FILE, NODE_MODULES_MARKER_DIR } from '../core/constants';
import { removeInternalState } from '../core/generate-project';
import { loadConfig } from '../core/load-config';
import { cleanGeneratedFiles } from '../generator/write-output';
import type { CleanCommandOptions, Logger } from '../types/internal';
import { pathExists, removeIfExists } from '../utils/fs';

export async function runClean(options: CleanCommandOptions, logger: Logger): Promise<void> {
  const loadedConfig = await loadConfig(options.config);
  const deleted = await cleanGeneratedFiles(loadedConfig, logger);
  await removeInternalState(loadedConfig);

  const markerDir = path.join(loadedConfig.configDir, NODE_MODULES_MARKER_DIR);
  if (await pathExists(markerDir)) {
    await removeIfExists(markerDir);
  }

  const cacheDir = path.join(loadedConfig.configDir, CACHE_DIR);
  if (await pathExists(cacheDir)) {
    await removeIfExists(cacheDir);
  }

  const manifestPath = path.join(loadedConfig.configDir, MANIFEST_FILE);
  if (await pathExists(manifestPath)) {
    await removeIfExists(manifestPath);
  }

  logger.info(`Removed ${deleted} generated file${deleted === 1 ? '' : 's'} and internal cache state.`);
}
