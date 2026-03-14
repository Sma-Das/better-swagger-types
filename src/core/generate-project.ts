import path from 'node:path';

import { MANIFEST_FILE, NODE_MODULES_MARKER_DIR } from './constants';
import { loadSchemaSource } from './load-schema-source';
import { loadConfig } from './load-config';
import { buildManifestSchemaEntry, readManifest, writeManifest, writeNodeModulesMarker } from './manifest';
import { parseSchema } from './parse-schema';
import { resolveSchemaSources } from './resolve-sources';
import { emitRootIndexFile, emitSchemaArtifacts, getSchemaArtifactPaths } from '../generator/emit-schema-folder';
import type { GenerateCommandOptions, LoadedConfig, Logger, ParsedSchema } from '../types/internal';
import { pathExists, removeIfExists } from '../utils/fs';
import { writeGeneratedFiles } from '../generator/write-output';

export interface GenerateSummary {
  loadedConfig: LoadedConfig;
  schemaCount: number;
  fileCount: number;
  writtenCount: number;
  staleDeleted: number;
  elapsedMs: number;
  parsedSchemas: ParsedSchema[];
}

export async function generateProject(options: GenerateCommandOptions, logger: Logger): Promise<GenerateSummary> {
  const startedAt = Date.now();
  const loadedConfig = await loadConfig(options.config);
  const previousManifest = await readManifest(loadedConfig);
  const resolvedSources = await resolveSchemaSources(loadedConfig, logger);
  const loadedSources = await Promise.all(
    resolvedSources.map((source) => loadSchemaSource(source, loadedConfig, options.cache ?? true, logger))
  );
  const parsedSchemas = await Promise.all(
    loadedSources.map((source) =>
      parseSchema(source, {
        resolveRefs: loadedConfig.config.generator.resolveRefs,
        logger
      })
    )
  );
  const manifestSchemas = parsedSchemas.map((schema) => buildManifestSchemaEntry(schema, loadedConfig));
  const previousSchemaMap =
    previousManifest?.version === 2
      ? new Map(previousManifest.schemas.map((schema) => [schema.name, schema]))
      : undefined;
  const changedSchemas = parsedSchemas.filter((schema, index) => {
    const nextSchema = manifestSchemas[index];
    if (!nextSchema) {
      return true;
    }

    const previousSchema = previousSchemaMap?.get(nextSchema.name);
    return !previousSchema || previousSchema.generationKey !== nextSchema.generationKey;
  });
  const artifacts = await Promise.all(changedSchemas.map((schema) => emitSchemaArtifacts(schema, loadedConfig)));
  const filesToWrite = artifacts.flatMap((artifact) => artifact.files);
  const expectedOutputPaths = parsedSchemas.flatMap((schema) => getSchemaArtifactPaths(schema.source.folderName, loadedConfig));
  const rootIndexFile = emitRootIndexFile(parsedSchemas, loadedConfig);

  filesToWrite.push(rootIndexFile);
  expectedOutputPaths.push(rootIndexFile.path);

  const { written, staleDeleted } = await writeGeneratedFiles(
    loadedConfig,
    filesToWrite,
    expectedOutputPaths,
    logger,
    previousManifest
  );
  await writeManifest(loadedConfig, expectedOutputPaths, manifestSchemas, previousManifest);

  if (loadedConfig.config.prismaStyleNodeModulesOutput) {
    await writeNodeModulesMarker(loadedConfig, expectedOutputPaths);
  } else {
    const markerDir = path.join(loadedConfig.configDir, NODE_MODULES_MARKER_DIR);
    if (await pathExists(markerDir)) {
      await removeIfExists(markerDir);
    }
  }

  return {
    loadedConfig,
    schemaCount: parsedSchemas.length,
    fileCount: expectedOutputPaths.length,
    writtenCount: written,
    staleDeleted,
    elapsedMs: Date.now() - startedAt,
    parsedSchemas
  };
}

export async function removeInternalState(loadedConfig: LoadedConfig): Promise<void> {
  const manifest = await readManifest(loadedConfig);
  const manifestPath = path.join(loadedConfig.configDir, MANIFEST_FILE);

  if (manifest) {
    await removeIfExists(manifestPath);
  }

  await removeIfExists(path.join(loadedConfig.configDir, '.better-swagger-types', 'cache'));
}
