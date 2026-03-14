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
  schemas: ManifestSchemaEntry[],
  previousManifest?: Manifest
): Promise<{ manifest: Manifest; written: boolean }> {
  const manifestPath = path.join(loadedConfig.configDir, MANIFEST_FILE);
  await ensureDir(path.dirname(manifestPath));

  const manifest = buildManifest(loadedConfig, outputFiles, schemas, previousManifest?.generatedAt);
  if (previousManifest && manifestsMatch(previousManifest, manifest)) {
    return { manifest: previousManifest, written: false };
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { manifest, written: true };
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

function buildManifest(
  loadedConfig: LoadedConfig,
  outputFiles: string[],
  schemas: ManifestSchemaEntry[],
  generatedAt?: string
): Manifest {
  return {
    version: 1,
    packageName: 'better-swagger-types',
    generatedAt: generatedAt ?? new Date().toISOString(),
    configPath: toPosixPath(path.relative(loadedConfig.configDir, loadedConfig.configPath) || path.basename(loadedConfig.configPath)),
    output: loadedConfig.config.output,
    files: outputFiles
      .map((filePath) => toPosixPath(path.relative(loadedConfig.configDir, filePath)))
      .sort((left, right) => left.localeCompare(right)),
    schemas: schemas.slice().sort((left, right) => left.name.localeCompare(right.name))
  };
}

function manifestsMatch(left: Manifest, right: Manifest): boolean {
  return (
    left.version === right.version &&
    left.packageName === right.packageName &&
    left.configPath === right.configPath &&
    left.output === right.output &&
    JSON.stringify(left.files) === JSON.stringify(right.files) &&
    JSON.stringify(left.schemas) === JSON.stringify(right.schemas)
  );
}
