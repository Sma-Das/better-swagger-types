import { readFile } from 'node:fs/promises';

import type { LoadedConfig, LoadedSchemaSource, Logger, ResolvedSchemaSource } from '../types/internal';
import { isUrl } from '../utils/fs';
import { fetchWithCache } from './fetch-cache';

export async function loadSchemaSource(
  source: ResolvedSchemaSource,
  loadedConfig: LoadedConfig,
  cache: boolean,
  logger: Logger
): Promise<LoadedSchemaSource> {
  if (isUrl(source.source)) {
    const fetched = await fetchWithCache(source.source, source.headers, {
      cache,
      logger,
      loadedConfig
    });

    return {
      ...source,
      contents: fetched.body,
      cacheKey: fetched.cacheKey
    };
  }

  return {
    ...source,
    contents: await readFile(source.source, 'utf8')
  };
}
