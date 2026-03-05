import path from 'node:path';

import { MANIFEST_FILE, NODE_MODULES_MARKER_DIR } from './constants';
import { loadSchemaSource } from './load-schema-source';
import { loadConfig } from './load-config';
import { readManifest, writeManifest, writeNodeModulesMarker } from './manifest';
import { parseSchema } from './parse-schema';
import { resolveSchemaSources } from './resolve-sources';
import { emitRootIndexFile, emitSchemaArtifacts } from '../generator/emit-schema-folder';
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
  const artifacts = await Promise.all(parsedSchemas.map((schema) => emitSchemaArtifacts(schema, loadedConfig)));
  const files = artifacts.flatMap((artifact) => artifact.files);
  files.push(emitRootIndexFile(parsedSchemas, loadedConfig));

  const { written, staleDeleted } = await writeGeneratedFiles(loadedConfig, files, logger);
  await writeManifest(
    loadedConfig,
    files.map((file) => file.path),
    parsedSchemas.map((schema) => ({
      name: schema.source.effectiveName,
      namespace: schema.source.namespace,
      folderName: schema.source.folderName,
      source: schema.source.source,
      schemaHash: schema.schemaHash
    }))
  );

  if (loadedConfig.config.prismaStyleNodeModulesOutput) {
    await writeNodeModulesMarker(loadedConfig, files.map((file) => file.path));
  } else {
    const markerDir = path.join(loadedConfig.configDir, NODE_MODULES_MARKER_DIR);
    if (await pathExists(markerDir)) {
      await removeIfExists(markerDir);
    }
  }

  return {
    loadedConfig,
    schemaCount: parsedSchemas.length,
    fileCount: files.length,
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
