import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { MANIFEST_FILE, NODE_MODULES_MARKER_DIR } from './constants';
import type { LoadedConfig, Manifest, ManifestSchemaEntry } from '../types/internal';
import { ensureDir, pathExists, toPosixPath, writeIfChanged } from '../utils/fs';

export async function readManifest(loadedConfig: LoadedConfig): Promise<Manifest | undefined> {
  const manifestPath = path.join(loadedConfig.configDir, MANIFEST_FILE);
  if (!(await pathExists(manifestPath))) {
    return undefined;
  }

  return JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
}

export async function writeManifest(
  loadedConfig: LoadedConfig,
  outputFiles: string[],
  schemas: ManifestSchemaEntry[]
): Promise<void> {
  const manifestPath = path.join(loadedConfig.configDir, MANIFEST_FILE);
  await ensureDir(path.dirname(manifestPath));

  const manifest: Manifest = {
    version: 1,
    packageName: 'better-swagger-types',
    generatedAt: new Date().toISOString(),
    configPath: toPosixPath(path.relative(loadedConfig.configDir, loadedConfig.configPath) || path.basename(loadedConfig.configPath)),
    output: loadedConfig.config.output,
    files: outputFiles.map((filePath) => toPosixPath(path.relative(loadedConfig.configDir, filePath))).sort((left, right) => left.localeCompare(right)),
    schemas: schemas.sort((left, right) => left.name.localeCompare(right.name))
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export async function writeNodeModulesMarker(loadedConfig: LoadedConfig, outputFiles: string[]): Promise<string> {
  const markerPath = path.join(loadedConfig.configDir, NODE_MODULES_MARKER_DIR, 'manifest.json');
  await ensureDir(path.dirname(markerPath));

  const payload = {
    packageName: 'better-swagger-types',
    output: loadedConfig.config.output,
    files: outputFiles.map((filePath) => toPosixPath(path.relative(loadedConfig.configDir, filePath))).sort((left, right) => left.localeCompare(right))
  };

  await writeIfChanged(markerPath, `${JSON.stringify(payload, null, 2)}\n`);
  return markerPath;
}
