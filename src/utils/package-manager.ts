import path from 'node:path';

import { pathExists } from './fs';

export type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm';

const LOCKFILES: Array<{ file: string; manager: PackageManager }> = [
  { file: 'bun.lock', manager: 'bun' },
  { file: 'bun.lockb', manager: 'bun' },
  { file: 'pnpm-lock.yaml', manager: 'pnpm' },
  { file: 'yarn.lock', manager: 'yarn' },
  { file: 'package-lock.json', manager: 'npm' }
];

export async function detectPackageManager(cwd: string): Promise<PackageManager> {
  for (const entry of LOCKFILES) {
    if (await pathExists(path.join(cwd, entry.file))) {
      return entry.manager;
    }
  }

  if (process.versions.bun) {
    return 'bun';
  }

  return 'npm';
}

export function packageManagerExec(manager: PackageManager): string {
  switch (manager) {
    case 'bun':
      return 'bunx';
    case 'pnpm':
      return 'pnpm exec';
    case 'yarn':
      return 'yarn dlx';
    case 'npm':
    default:
      return 'npx';
  }
}
