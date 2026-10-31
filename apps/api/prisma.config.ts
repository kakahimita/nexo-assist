import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnvironment } from 'dotenv';
import { defineConfig } from 'prisma/config';

const apiRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(apiRoot, '..', '..');

loadEnvironment({ path: resolve(repositoryRoot, '.env'), override: false, quiet: true });

const filePrefix = 'file:';
const rawUrl = process.env.DATABASE_URL ?? `${filePrefix}./data/nexo.db`;
const rawPath = rawUrl.startsWith(filePrefix) ? rawUrl.slice(filePrefix.length) : undefined;

if (rawPath === undefined || rawPath === ':memory:' || rawPath.trim() === '') {
  throw new Error('DATABASE_URL must reference a file-backed SQLite database.');
}

const databasePath = resolve(repositoryRoot, rawPath);
mkdirSync(dirname(databasePath), { recursive: true });

export default defineConfig({
  schema: resolve(apiRoot, 'prisma', 'schema.prisma'),
  migrations: {
    path: resolve(apiRoot, 'prisma', 'migrations'),
  },
  datasource: {
    url: `${filePrefix}${databasePath.replaceAll('\\', '/')}`,
  },
});
