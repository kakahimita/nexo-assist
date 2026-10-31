import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { createDatabaseClient } from '../../src/database/client.js';
import { initializeDatabase } from '../../src/database/initialize.js';

const execFileAsync = promisify(execFile);

const apiRoot = resolve(import.meta.dirname, '..', '..');
const prismaCli = resolve(apiRoot, '..', '..', 'node_modules', 'prisma', 'build', 'index.js');

export interface TestDatabase {
  url: string;
  cleanup(): Promise<void>;
}

function toFileUrl(databasePath: string): string {
  return `file:${databasePath.replaceAll('\\', '/')}`;
}

export async function migrateDatabase(databaseUrl: string): Promise<void> {
  await execFileAsync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

export async function createMigratedTestDatabase(): Promise<TestDatabase> {
  const directory = await mkdtemp(join(tmpdir(), 'nexo database with spaces-'));
  const url = toFileUrl(join(directory, 'nexo test.db'));

  try {
    await migrateDatabase(url);
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }

  return {
    url,
    async cleanup() {
      await rm(directory, { recursive: true, force: true });
    },
  };
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const database = await createMigratedTestDatabase();
  const client = createDatabaseClient(database.url);

  try {
    await initializeDatabase(client);
  } catch (error) {
    await database.cleanup();
    throw error;
  } finally {
    await client.$disconnect();
  }

  return database;
}
