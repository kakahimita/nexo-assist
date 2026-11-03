import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestDatabase } from './support/test-database.js';
import { createDatabaseClient } from '../src/database/client.js';

describe('B14: conversation message limit', () => {
  it('accepts only one simultaneous message and rejects streaming before headers at the cap', async () => {
    const db = await createTestDatabase();
    const client = createDatabaseClient(db.url);
    const app = await createApp({
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
      databaseUrl: db.url,
      consultationEngine: 'fixture',
    });
    try {
      const server = app.getHttpServer();
      const auth = await request(server)
        .post('/api/session')
        .send({ email: 'ana.souza@nexo.com.br', password: 'x' })
        .expect(201);
      const cookie = String(auth.headers['set-cookie']?.[0]);
      const created = await request(server)
        .post('/api/conversations')
        .set('Cookie', cookie)
        .send({})
        .expect(201);
      const id = String(created.body.id);
      const path = `/api/conversations/${id}/messages`;
      for (let i = 0; i < 29; i++)
        await request(server)
          .post(path)
          .set('Cookie', cookie)
          .send({ content: `Mensagem ${i}` })
          .expect(201);
      const results = await Promise.all([
        request(server).post(path).set('Cookie', cookie).send({ content: 'a' }),
        request(server).post(path).set('Cookie', cookie).send({ content: 'b' }),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
      const stream = await request(server)
        .post(`${path}/stream`)
        .set('Cookie', cookie)
        .send({ content: 'Windows 11' })
        .expect(409);
      expect(stream.headers['content-type']).toContain('application/json');
      expect(stream.body).toEqual({ code: 'session_limit', limit: 30, used: 30 });
      expect(await client.message.count({ where: { conversationId: id, role: 'employee' } })).toBe(
        30,
      );
    } finally {
      await app.close();
      await client.$disconnect();
      await db.cleanup();
    }
  });
  it('enforces the limit after restart without leaking another employee’s conversation', async () => {
    const db = await createTestDatabase();
    const env = {
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
      databaseUrl: db.url,
      consultationEngine: 'fixture' as const,
    };
    let app = await createApp(env);
    const client = createDatabaseClient(db.url);
    try {
      let server = app.getHttpServer();
      const login = async (email: string) =>
        String(
          (await request(server).post('/api/session').send({ email, password: 'x' }).expect(201))
            .headers['set-cookie']?.[0],
        );
      const ana = await login('ana.souza@nexo.com.br');
      const bruno = await login('bruno.lima@nexo.com.br');
      const analyst = await login('analista@nexo.com.br');
      const created = await request(server)
        .post('/api/conversations')
        .set('Cookie', ana)
        .send({})
        .expect(201);
      const id = String(created.body.id);
      const path = `/api/conversations/${id}/messages`;
      await request(server).post(path).set('Cookie', analyst).send({ content: 'x' }).expect(403);
      await request(server).post(path).set('Cookie', bruno).send({ content: 'x' }).expect(404);
      for (let i = 0; i < 30; i++)
        await request(server)
          .post(path)
          .set('Cookie', ana)
          .send({ content: `Mensagem ${i}` })
          .expect(201);
      await app.close();
      app = await createApp(env);
      server = app.getHttpServer();
      const response = await request(server)
        .post(path)
        .set('Cookie', ana)
        .send({ content: 'excesso' })
        .expect(409);
      expect(response.body).toEqual({ code: 'session_limit', limit: 30, used: 30 });
      expect(await client.message.count({ where: { conversationId: id, role: 'employee' } })).toBe(
        30,
      );
    } finally {
      await app.close();
      await client.$disconnect();
      await db.cleanup();
    }
  });
});
