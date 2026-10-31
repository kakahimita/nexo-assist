import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import type { ApiEnvironment } from '../src/config/environment.js';
import { createTestDatabase } from './support/test-database.js';

const baseEnvironment: Omit<ApiEnvironment, 'databaseUrl'> = {
  host: '127.0.0.1',
  port: 3001,
  webOrigin: 'http://localhost:3000',
};

describe('B17 / PRD p. 2: API health and readiness', () => {
  it('B17: distinguishes liveness from migrated readiness', async () => {
    const database = await createTestDatabase();
    const emptyDirectory = await mkdtemp(join(tmpdir(), 'nexo unready api with spaces-'));
    const emptyDatabasePath = join(emptyDirectory, 'empty.db');
    await writeFile(emptyDatabasePath, '');

    let app: INestApplication | undefined;
    let unreadyApp: INestApplication | undefined;

    try {
      app = await createApp({ ...baseEnvironment, databaseUrl: database.url });
      unreadyApp = await createApp({
        ...baseEnvironment,
        databaseUrl: `file:${emptyDatabasePath.replaceAll('\\', '/')}`,
      });

      await request(app.getHttpServer())
        .get('/api/health')
        .expect(200, { status: 'ok', service: 'nexo-api' });
      await request(app.getHttpServer())
        .get('/api/ready')
        .expect(200, { status: 'ok', service: 'nexo-api', database: 'ready' });
      await request(unreadyApp.getHttpServer())
        .get('/api/health')
        .expect(200, { status: 'ok', service: 'nexo-api' });
      await request(unreadyApp.getHttpServer())
        .get('/api/ready')
        .expect(503, { status: 'unavailable', service: 'nexo-api', database: 'unavailable' });
    } finally {
      await app?.close();
      await unreadyApp?.close();
      await database.cleanup();
      await rm(emptyDirectory, { recursive: true, force: true });
    }
  });

  it('B17: allows only the configured web origin through CORS', async () => {
    const database = await createTestDatabase();
    const app = await createApp({ ...baseEnvironment, databaseUrl: database.url });

    try {
      const allowed = await request(app.getHttpServer())
        .get('/api/health')
        .set('Origin', 'http://localhost:3000');
      expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');

      const rejected = await request(app.getHttpServer())
        .get('/api/health')
        .set('Origin', 'http://evil.test');
      expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await app.close();
      await database.cleanup();
    }
  });

  it('B17: does not expose agent, Mastra, or ticket endpoints', async () => {
    const database = await createTestDatabase();
    const app = await createApp({ ...baseEnvironment, databaseUrl: database.url });

    try {
      for (const path of ['/api/agents', '/api/mastra', '/api/tickets']) {
        await request(app.getHttpServer()).get(path).expect(404);
      }
    } finally {
      await app.close();
      await database.cleanup();
    }
  });
});
