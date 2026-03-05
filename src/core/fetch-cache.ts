import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { CACHE_DIR } from './constants';
import type { LoadedConfig, Logger } from '../types/internal';
import { ensureDir, pathExists } from '../utils/fs';
import { sha256, stableStringify } from '../utils/hash';

interface CacheEntryMeta {
  etag?: string | undefined;
  lastModified?: string | undefined;
  url: string;
}

export interface FetchWithCacheOptions {
  cache: boolean;
  logger: Logger;
  loadedConfig: LoadedConfig;
}

export interface FetchWithCacheResult {
  body: string;
  cacheKey: string;
}

export async function fetchWithCache(
  url: string,
  headers: Record<string, string>,
  options: FetchWithCacheOptions
): Promise<FetchWithCacheResult> {
  const cacheKey = sha256(`${url}:${stableStringify(headers)}`);
  const cacheDirectory = path.join(path.dirname(options.loadedConfig.configPath), CACHE_DIR);
  const bodyPath = path.join(cacheDirectory, `${cacheKey}.json`);
  const metaPath = path.join(cacheDirectory, `${cacheKey}.meta.json`);
  const cachedMeta = options.cache ? await readJson<CacheEntryMeta>(metaPath) : undefined;

  const requestHeaders = new Headers(headers);
  if (options.cache && cachedMeta?.etag) {
    requestHeaders.set('If-None-Match', cachedMeta.etag);
  }
  if (options.cache && cachedMeta?.lastModified) {
    requestHeaders.set('If-Modified-Since', cachedMeta.lastModified);
  }

  const response = await fetch(url, { headers: requestHeaders });

  if (response.status === 304 && options.cache && (await pathExists(bodyPath))) {
    options.logger.debug(`Cache hit for ${url}`);
    return {
      body: await readFile(bodyPath, 'utf8'),
      cacheKey
    };
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}. Check the URL and any configured headers.`);
  }

  const body = await response.text();
  if (options.cache) {
    await ensureDir(cacheDirectory);
    await writeFile(bodyPath, body, 'utf8');
    const meta: CacheEntryMeta = {
      url,
      etag: response.headers.get('etag') ?? undefined,
      lastModified: response.headers.get('last-modified') ?? undefined
    };
    await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  }

  return { body, cacheKey };
}

async function readJson<T>(targetPath: string): Promise<T | undefined> {
  if (!(await pathExists(targetPath))) {
    return undefined;
  }

  return JSON.parse(await readFile(targetPath, 'utf8')) as T;
}
