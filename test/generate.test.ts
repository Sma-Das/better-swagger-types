import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi, afterEach } from 'vitest';

import { runClean } from '../src/commands/clean';
import { MANIFEST_FILE } from '../src/core/constants';
import { generateProject } from '../src/core/generate-project';
import { fetchWithCache } from '../src/core/fetch-cache';
import { createLogger } from '../src/utils/log';
import type { LoadedConfig } from '../src/types/internal';

const logger = createLogger(false);
const tempDirectories: string[] = [];

async function createFixtureCopy(fixtureName: string): Promise<string> {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'better-swagger-types-'));
  tempDirectories.push(tempDirectory);
  await cp(path.join(process.cwd(), 'test/fixtures', fixtureName), tempDirectory, { recursive: true });
  return tempDirectory;
}

async function snapshotDirectory(directory: string): Promise<string> {
  const parts: string[] = [];
  await walk(directory, directory, parts);
  return parts.join('\n');
}

async function walk(root: string, current: string, parts: string[]): Promise<void> {
  const entries = (await readdir(current, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(root, fullPath, parts);
      continue;
    }

    const relativePath = path.relative(root, fullPath).split(path.sep).join('/');
    const contents = await readFile(fullPath, 'utf8');
    parts.push(`>>> ${relativePath}`);
    parts.push(contents.trimEnd());
  }
}

afterEach(async () => {
  vi.restoreAllMocks();
  while (tempDirectories.length > 0) {
    const tempDirectory = tempDirectories.pop();
    if (tempDirectory) {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }
});

describe('generateProject', () => {
  it('generates the expected output for a basic schema fixture', async () => {
    const fixtureDirectory = await createFixtureCopy('basic');
    const configPath = path.join(fixtureDirectory, 'api.swagger-types.ts');

    const summary = await generateProject({ config: configPath, cache: true }, logger);
    expect(summary.schemaCount).toBe(1);
    expect(summary.fileCount).toBe(7);

    const output = await snapshotDirectory(path.join(fixtureDirectory, 'lib/generated'));
    expect(output).toMatchSnapshot();
  });

  it('expands directory sources into multiple schema namespaces', async () => {
    const fixtureDirectory = await createFixtureCopy('multi');
    const configPath = path.join(fixtureDirectory, 'api.swagger-types.ts');

    await generateProject({ config: configPath, cache: true }, logger);

    const rootIndex = await readFile(path.join(fixtureDirectory, 'lib/generated/index.ts'), 'utf8');
    expect(rootIndex).toContain("export * as ServicesBilling");
    expect(rootIndex).toContain("export * as ServicesUsers");
  });

  it('cleans generated output via the manifest', async () => {
    const fixtureDirectory = await createFixtureCopy('basic');
    const configPath = path.join(fixtureDirectory, 'api.swagger-types.ts');

    await generateProject({ config: configPath, cache: true }, logger);
    await runClean({ config: configPath }, logger);

    const generatedDirectory = path.join(fixtureDirectory, 'lib/generated');
    await expect(readFile(path.join(generatedDirectory, 'index.ts'), 'utf8')).rejects.toThrow();
  });

  it('does not rewrite generated files or the manifest on an unchanged rerun', async () => {
    const fixtureDirectory = await createFixtureCopy('basic');
    const configPath = path.join(fixtureDirectory, 'api.swagger-types.ts');

    await generateProject({ config: configPath, cache: true }, logger);
    const manifestPath = path.join(fixtureDirectory, MANIFEST_FILE);
    const firstManifest = await readFile(manifestPath, 'utf8');

    await new Promise((resolve) => setTimeout(resolve, 10));

    const summary = await generateProject({ config: configPath, cache: true }, logger);
    const secondManifest = await readFile(manifestPath, 'utf8');

    expect(summary.writtenCount).toBe(0);
    expect(secondManifest).toBe(firstManifest);
  });
});

describe('fetchWithCache', () => {
  it('reuses cached bodies after a 304 response', async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'better-swagger-types-cache-'));
    tempDirectories.push(tempDirectory);
    const loadedConfig: LoadedConfig = {
      configPath: path.join(tempDirectory, 'api.swagger-types.ts'),
      configDir: tempDirectory,
      config: {
        output: 'lib/generated',
        prismaStyleNodeModulesOutput: false,
        schemas: [],
        generator: {
          emitOperations: true,
          emitSchemas: true,
          resolveRefs: true,
          naming: 'stable'
        }
      }
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('{"ok":true}', {
          status: 200,
          headers: {
            etag: 'v1'
          }
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));

    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchWithCache('https://example.com/schema.json', {}, { cache: true, loadedConfig, logger });
    const second = await fetchWithCache('https://example.com/schema.json', {}, { cache: true, loadedConfig, logger });

    expect(first.body).toBe('{"ok":true}');
    expect(second.body).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://example.com/schema.json');
    const secondCallHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Headers;
    expect(secondCallHeaders.get('If-None-Match')).toBe('v1');
  });
});
