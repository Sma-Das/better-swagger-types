import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(targetPath: string): Promise<void> {
  await mkdir(targetPath, { recursive: true });
}

export async function writeIfChanged(targetPath: string, contents: string): Promise<boolean> {
  let current: string | undefined;

  try {
    current = await readFile(targetPath, 'utf8');
  } catch {
    current = undefined;
  }

  if (current === contents) {
    return false;
  }

  await ensureDir(path.dirname(targetPath));
  await writeFile(targetPath, contents, 'utf8');
  return true;
}

export async function removeIfExists(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true });
}

export async function removeEmptyDirectories(startDirectory: string, stopDirectory: string): Promise<void> {
  let current = startDirectory;
  const boundary = path.resolve(stopDirectory);

  while (current.startsWith(boundary) && current !== boundary) {
    try {
      await rm(current);
    } catch {
      return;
    }
    current = path.dirname(current);
  }
}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}
