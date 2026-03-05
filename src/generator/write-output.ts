import path from 'node:path';

import { NODE_MODULES_MARKER_DIR } from '../core/constants';
import { readManifest } from '../core/manifest';
import type { GeneratedFile, LoadedConfig, Logger } from '../types/internal';
import { removeEmptyDirectories, removeIfExists, writeIfChanged } from '../utils/fs';

export async function writeGeneratedFiles(
  loadedConfig: LoadedConfig,
  files: GeneratedFile[],
  logger: Logger
): Promise<{ written: number; staleDeleted: number }> {
  let written = 0;
  const previousManifest = await readManifest(loadedConfig);
  const nextPaths = new Set(files.map((file) => path.resolve(file.path)));

  for (const file of files) {
    const changed = await writeIfChanged(file.path, file.contents);
    if (changed) {
      written += 1;
      logger.debug(`Wrote ${path.relative(process.cwd(), file.path)}`);
    }
  }

  let staleDeleted = 0;
  if (previousManifest) {
    for (const previousRelativePath of previousManifest.files) {
      const absolutePath = path.join(loadedConfig.configDir, previousRelativePath);
      if (nextPaths.has(path.resolve(absolutePath))) {
        continue;
      }

      await removeIfExists(absolutePath);
      await removeEmptyDirectories(path.dirname(absolutePath), path.join(loadedConfig.configDir, loadedConfig.config.output));
      staleDeleted += 1;
      logger.debug(`Deleted stale file ${previousRelativePath}`);
    }
  }

  return { written, staleDeleted };
}

export async function cleanGeneratedFiles(
  loadedConfig: LoadedConfig,
  logger: Logger
): Promise<number> {
  const manifest = await readManifest(loadedConfig);
  if (!manifest) {
    throw new Error('No manifest found. Run generate first or remove generated files manually.');
  }

  let deleted = 0;
  for (const relativePath of manifest.files) {
    const absolutePath = path.join(loadedConfig.configDir, relativePath);
    await removeIfExists(absolutePath);
    deleted += 1;
    logger.debug(`Deleted ${relativePath}`);
  }

  const outputRoot = path.join(loadedConfig.configDir, loadedConfig.config.output);
  await removeEmptyDirectories(outputRoot, loadedConfig.configDir);

  if (loadedConfig.config.prismaStyleNodeModulesOutput) {
    await removeIfExists(path.join(loadedConfig.configDir, NODE_MODULES_MARKER_DIR));
  }

  return deleted;
}
