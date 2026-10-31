import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { config as loadEnvironment } from 'dotenv';

import { REPOSITORY_ROOT, resolveDatabaseUrl } from '../config/paths.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createDatabaseClient } from './client.js';
import { identityFixtures } from '../identity/fixtures.js';

export async function initializeDatabase(client: PrismaClient): Promise<void> {
  await client.systemMetadata.upsert({
    where: { key: 'installation-id' },
    update: {},
    create: { key: 'installation-id', value: randomUUID() },
  });
  for (const fixture of identityFixtures) {
    await client.user.upsert({ where: { email: fixture.email }, update: {}, create: fixture });
  }
}

async function main(): Promise<void> {
  loadEnvironment({ path: resolve(REPOSITORY_ROOT, '.env'), override: false, quiet: true });

  const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL ?? 'file:./data/nexo.db');
  const client = createDatabaseClient(databaseUrl);

  try {
    await initializeDatabase(client);
  } finally {
    await client.$disconnect();
  }
}

const entrypoint = process.argv[1];

if (entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Database initialization failed.');
    process.exitCode = 1;
  });
}
