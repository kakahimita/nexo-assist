import { createHash } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createDatabaseClient } from '../src/database/client.js';
import { createTestDatabase } from './support/test-database.js';

describe('B01: server session', () => {
  it('authenticates fixtures and rejects invalid, expired and revoked sessions', async () => {
    const db = await createTestDatabase();
    const app = await createApp({ host: '127.0.0.1', port: 3001, webOrigin: 'http://localhost:3000', databaseUrl: db.url });
    const client = createDatabaseClient(db.url);
    try {
      const server = app.getHttpServer();
      await request(server).post('/api/session').send({ email: 'unknown@nexo.com.br', password: 'x' }).expect(401);
      await request(server).post('/api/session').send({ email: 'ana.souza@nexo.com.br', password: '' }).expect(400);
      await request(server).post('/api/session').send({ email: 'ana.souza@nexo.com.br', password: 'x', role: 'analyst' }).expect(400);
      const login = await request(server).post('/api/session').send({ email: ' ANA.SOUZA@nexo.com.br ', password: 'x' }).expect(201);
      expect(login.body.role).toBe('employee');
      expect(login.body.token).toBeUndefined();
      const cookie = String(login.headers['set-cookie']?.[0]);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\//i);
      await request(server).get('/api/session').set('Cookie', cookie).expect(200);
      await request(server).get('/api/session').set('Cookie', 'nexo_session=bad').expect(401);
      const token = cookie.split(';')[0]!.split('=')[1]!;
      await client.session.update({ where: { tokenHash: createHash('sha256').update(token).digest('hex') }, data: { expiresAt: new Date(0) } });
      await request(server).get('/api/session').set('Cookie', cookie).expect(401);
      const analyst = await request(server).post('/api/session').send({ email: 'analista@nexo.com.br', password: 'any' }).expect(201);
      expect(analyst.body.role).toBe('analyst');
      const analystCookie = String(analyst.headers['set-cookie']?.[0]);
      await request(server).delete('/api/session').set('Cookie', analystCookie).expect(204);
      await request(server).get('/api/session').set('Cookie', analystCookie).expect(401);
    } finally { await client.$disconnect(); await app.close(); await db.cleanup(); }
  });
});
