import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestDatabase } from './support/test-database.js';

describe('B01 B13 B16: authorized persistent history', () => {
  it('isolates employees and restores history after restart', async () => {
    const db = await createTestDatabase();
    const env = { host: '127.0.0.1', port: 3001, webOrigin: 'http://localhost:3000', databaseUrl: db.url };
    let app = await createApp(env);
    try {
      let server = app.getHttpServer();
      async function login(email: string): Promise<string> {
        const result = await request(server).post('/api/session').send({ email, password: 'x' }).expect(201);
        return String(result.headers['set-cookie']?.[0]);
      }
      const ana = await login('ana.souza@nexo.com.br');
      const bruno = await login('bruno.lima@nexo.com.br');
      const analyst = await login('analista@nexo.com.br');
      await request(server).get('/api/conversations').expect(401);
      await request(server).get('/api/conversations').set('Cookie', analyst).expect(403);
      await request(server).post('/api/conversations').set('Cookie', ana).send({ ownerId: 'forged' }).expect(400);
      const conversation = await request(server).post('/api/conversations').set('Cookie', ana).send({}).expect(201);
      const path = `/api/conversations/${conversation.body.id}/messages`;
      await request(server).post(path).set('Cookie', ana).send({ content: 'Olá' }).expect(201);
      await request(server).post(path).set('Cookie', ana).send({ content: ' ' }).expect(400);
      await request(server).post(path).set('Cookie', ana).send({ content: 'x', role: 'analyst' }).expect(400);
      expect((await request(server).get('/api/conversations').set('Cookie', bruno).expect(200)).body).toEqual([]);
      await request(server).get(path).set('Cookie', bruno).expect(404);
      await request(server).post(path).set('Cookie', bruno).send({ content: 'x' }).expect(404);
      await app.close();
      app = await createApp(env);
      server = app.getHttpServer();
      expect((await request(server).get('/api/conversations').set('Cookie', ana).expect(200)).body).toHaveLength(1);
      const messages = (await request(server).get(path).set('Cookie', ana).expect(200)).body;
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Olá');
    } finally { await app.close(); await db.cleanup(); }
  });
});
