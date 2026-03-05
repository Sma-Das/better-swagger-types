import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import fg from 'fast-glob';

import { makeEffectiveName, makeFolderName, makeNamespace } from '../generator/naming';
import type { LoadedConfig, Logger, ResolvedSchemaSource, SourceKind } from '../types/internal';
import { isUrl } from '../utils/fs';

const GLOB_PATTERN = /[*?{}\[\]]/;

export async function resolveSchemaSources(loadedConfig: LoadedConfig, logger: Logger): Promise<ResolvedSchemaSource[]> {
  const resolvedSources: ResolvedSchemaSource[] = [];
  const usedNames = new Set<string>();
  const usedNamespaces = new Set<string>();
  const usedFolders = new Set<string>();

  for (const schema of loadedConfig.config.schemas) {
    const matches = await expandSource(schema.source, loadedConfig.configDir);
    const multipleMatches = matches.length > 1;

    for (const match of matches) {
      const effectiveName = makeEffectiveName(schema.name, match.source, multipleMatches);
      const namespace = makeNamespace(schema.namespace, effectiveName, match.source, multipleMatches);
      const folderName = makeFolderName(effectiveName);

      assertUnique(usedNames, effectiveName, `schema name \`${effectiveName}\``);
      assertUnique(usedNamespaces, namespace, `schema namespace \`${namespace}\``);
      assertUnique(usedFolders, folderName, `schema folder \`${folderName}\``);

      const source: ResolvedSchemaSource = {
        configuredName: schema.name,
        configuredNamespace: schema.namespace,
        configuredSource: schema.source,
        effectiveName,
        namespace,
        folderName,
        source: match.source,
        sourceKind: match.sourceKind,
        headers: schema.headers ?? {},
        format: schema.format ?? 'auto'
      };

      logger.debug(`Resolved schema source ${schema.source} -> ${source.source}`);
      resolvedSources.push(source);
    }
  }

  resolvedSources.sort((left, right) => left.effectiveName.localeCompare(right.effectiveName));
  return resolvedSources;
}

async function expandSource(source: string, configDir: string): Promise<Array<{ source: string; sourceKind: SourceKind }>> {
  if (isUrl(source)) {
    return [{ source, sourceKind: 'url' }];
  }

  const resolvedSource = path.resolve(configDir, source);

  if (GLOB_PATTERN.test(source)) {
    const matches = await fg(source, {
      cwd: configDir,
      onlyFiles: true,
      absolute: true,
      unique: true
    });

    if (matches.length === 0) {
      throw new Error(`Glob source ${source} did not match any files.`);
    }

    return matches.sort((left, right) => left.localeCompare(right)).map((entry) => ({ source: entry, sourceKind: 'glob' }));
  }

  const details = await stat(resolvedSource).catch(() => undefined);

  if (!details) {
    throw new Error(`Schema source ${source} was not found.`);
  }

  if (details.isDirectory()) {
    const entries = await readdir(resolvedSource, { withFileTypes: true });
    const matches = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => path.join(resolvedSource, entry.name))
      .sort((left, right) => left.localeCompare(right));

    if (matches.length === 0) {
      throw new Error(`Directory source ${source} did not contain any .json files.`);
    }

    return matches.map((entry) => ({ source: entry, sourceKind: 'directory' }));
  }

  if (!details.isFile()) {
    throw new Error(`Schema source ${source} must be a file, directory, glob, or URL.`);
  }

  return [{ source: resolvedSource, sourceKind: 'file' }];
}

function assertUnique(usedValues: Set<string>, value: string, label: string): void {
  if (usedValues.has(value)) {
    throw new Error(`Resolved ${label} collided. Use unique schema names or namespaces in your config.`);
  }

  usedValues.add(value);
}
