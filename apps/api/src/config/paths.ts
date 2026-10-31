import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function findRepositoryRoot(startUrl: string): string {
  let current = dirname(fileURLToPath(startUrl));

  for (;;) {
    try {
      const manifest: unknown = JSON.parse(readFileSync(resolve(current, 'package.json'), 'utf8'));

      if (
        typeof manifest === 'object' &&
        manifest !== null &&
        'workspaces' in manifest &&
        Array.isArray(manifest.workspaces)
      ) {
        return current;
      }
    } catch {
      // Keep walking until the root package with workspaces is found.
    }

    const parent = dirname(current);

    if (parent === current) {
      throw new Error('Could not locate the repository root package.');
    }

    current = parent;
  }
}

export const REPOSITORY_ROOT = findRepositoryRoot(import.meta.url);

const FILE_PREFIX = 'file:';

export function resolveDatabaseUrl(raw: string): string {
  if (!raw.startsWith(FILE_PREFIX)) {
    throw new Error('DATABASE_URL must reference a file-backed SQLite database.');
  }

  const rawPath = raw.slice(FILE_PREFIX.length);

  if (rawPath === ':memory:' || rawPath.trim() === '') {
    throw new Error('DATABASE_URL must reference a file-backed SQLite database.');
  }

  return `${FILE_PREFIX}${resolve(REPOSITORY_ROOT, rawPath).replaceAll('\\', '/')}`;
}
