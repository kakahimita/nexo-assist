import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPOSITORY_ROOT, resolveDatabaseUrl } from '../src/config/paths.js';
import { createDatabaseClient } from '../src/database/client.js';
import { DatabaseService } from '../src/database/database.service.js';
import { initializeDatabase } from '../src/database/initialize.js';
import {
  createMigratedTestDatabase,
  createTestDatabase,
  migrateDatabase,
} from './support/test-database.js';

describe('B17 / PRD p. 2: migrated, file-backed SQLite persistence', () => {
  it('B17: keeps one installation marker across clients and repeated initialization', async () => {
    const database = await createTestDatabase();

    try {
      const first = createDatabaseClient(database.url);
      let before: string;

      try {
        await initializeDatabase(first);
        before = (
          await first.systemMetadata.findUniqueOrThrow({ where: { key: 'installation-id' } })
        ).value;
      } finally {
        await first.$disconnect();
      }

      const second = createDatabaseClient(database.url);

      try {
        await initializeDatabase(second);
        const after = await second.systemMetadata.findUniqueOrThrow({
          where: { key: 'installation-id' },
        });
        expect(after.value).toBe(before);
        expect(await second.systemMetadata.count()).toBe(1);
      } finally {
        await second.$disconnect();
      }

      const service = new DatabaseService(database.url);

      try {
        expect(await service.isReady()).toBe(true);
      } finally {
        await service.onModuleDestroy();
      }
    } finally {
      await database.cleanup();
    }
  });

  it('B17: fresh migrated database without initialization is unready', async () => {
    const database = await createMigratedTestDatabase();

    try {
      const service = new DatabaseService(database.url);

      try {
        expect(await service.isReady()).toBe(false);
      } finally {
        await service.onModuleDestroy();
      }
    } finally {
      await database.cleanup();
    }
  });

  it('B17: repeated migrate deploy preserves the installation marker', async () => {
    const database = await createTestDatabase();
    const client = createDatabaseClient(database.url);

    try {
      const before = await client.systemMetadata.findUniqueOrThrow({
        where: { key: 'installation-id' },
      });
      await migrateDatabase(database.url);
      const after = await client.systemMetadata.findUniqueOrThrow({
        where: { key: 'installation-id' },
      });
      expect(after.value).toBe(before.value);
    } finally {
      await client.$disconnect();
      await database.cleanup();
    }
  });

  it('B17: two test databases receive different URLs and files', async () => {
    const first = await createTestDatabase();
    const second = await createTestDatabase();

    try {
      expect(second.url).not.toBe(first.url);
    } finally {
      await first.cleanup();
      await second.cleanup();
    }
  });

  it('B17: root and API working directories resolve the same development file', () => {
    const previousDirectory = process.cwd();
    const developmentDatabase = resolve(REPOSITORY_ROOT, 'data', 'nexo.db');
    const hashBefore = existsSync(developmentDatabase)
      ? createHash('sha256').update(readFileSync(developmentDatabase)).digest('hex')
      : null;

    try {
      process.chdir(REPOSITORY_ROOT);
      const fromRoot = resolveDatabaseUrl('file:./data/nexo.db');
      process.chdir(resolve(REPOSITORY_ROOT, 'apps', 'api'));
      const fromApi = resolveDatabaseUrl('file:./data/nexo.db');

      expect(fromApi).toBe(fromRoot);
      expect(fromRoot).toBe(`file:${developmentDatabase.replaceAll('\\', '/')}`);
    } finally {
      process.chdir(previousDirectory);
    }

    const hashAfter = existsSync(developmentDatabase)
      ? createHash('sha256').update(readFileSync(developmentDatabase)).digest('hex')
      : null;
    expect(hashAfter).toBe(hashBefore);
  });

  it('B17: rejects memory and network database URLs', () => {
    expect(() => resolveDatabaseUrl('file::memory:')).toThrow();
    expect(() => resolveDatabaseUrl('https://example.test/db')).toThrow();
  });
});
