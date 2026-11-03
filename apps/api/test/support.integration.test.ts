import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestDatabase } from './support/test-database.js';

describe('B11: analyst queue and conversation detail', () => {
  it('lists and reads waiting conversations with employee ticket context', async () => {
    const db = await createTestDatabase();
    const env = {
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
      databaseUrl: db.url,
    };
    const app = await createApp(env);
    try {
      const server = app.getHttpServer();
      const login = async (email: string) =>
        String(
          (await request(server).post('/api/session').send({ email, password: 'x' }).expect(201))
            .headers['set-cookie']?.[0],
        );
      const ana = await login('ana.souza@nexo.com.br');
      const bruno = await login('bruno.lima@nexo.com.br');
      const analyst = await login('analista@nexo.com.br');

      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', ana)
        .send({})
        .expect(201);

      await request(server)
        .post(`/api/conversations/${conversation.body.id}/handoff`)
        .set('Cookie', ana)
        .send({ reason: 'employee_request' })
        .expect(201);

      const queue = await request(server)
        .get('/api/support/conversations')
        .query({ filter: 'waiting' })
        .set('Cookie', analyst)
        .expect(200);
      expect(queue.body).toHaveLength(1);
      expect(queue.body[0]).toMatchObject({
        id: conversation.body.id,
        state: 'waiting_for_analyst',
        employee: { name: 'Ana Souza' },
        handoff: { reason: 'employee_request' },
      });

      const detail = await request(server)
        .get(`/api/support/conversations/${conversation.body.id}`)
        .set('Cookie', analyst)
        .expect(200);
      expect(detail.body).toMatchObject({
        conversation: { id: conversation.body.id },
      });
      expect(Array.isArray(detail.body.messages)).toBe(true);
      expect(Array.isArray(detail.body.tickets)).toBe(true);
      expect(detail.body.tickets.length).toBeGreaterThan(0);

      await request(server).get('/api/support/conversations').set('Cookie', ana).expect(403);
      await request(server).get('/api/support/conversations').set('Cookie', bruno).expect(403);
    } finally {
      await app.close();
      await db.cleanup();
    }
  });

  it('claims, replies, returns, and closes with ownership enforced', async () => {
    const db = await createTestDatabase();
    const env = {
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
      databaseUrl: db.url,
    };
    const app = await createApp(env);
    try {
      const server = app.getHttpServer();
      const login = async (email: string) => {
        const response = await request(server)
          .post('/api/session')
          .send({ email, password: 'x' })
          .expect(201);
        return {
          cookie: String(response.headers['set-cookie']?.[0]),
          user: response.body as { id: string },
        };
      };
      const ana = await login('ana.souza@nexo.com.br');
      const analyst = await login('analista@nexo.com.br');
      const rafael = await login('rafael.lima@nexo.com.br');

      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', ana.cookie)
        .send({})
        .expect(201);
      const path = `/api/support/conversations/${conversation.body.id}`;

      await request(server)
        .post(`/api/conversations/${conversation.body.id}/handoff`)
        .set('Cookie', ana.cookie)
        .send({ reason: 'employee_request' })
        .expect(201);

      const claimed = await request(server)
        .post(`${path}/claim`)
        .set('Cookie', analyst.cookie)
        .send({})
        .expect(201);
      expect(claimed.body).toMatchObject({
        id: conversation.body.id,
        state: 'with_analyst',
        stateVersion: 2,
        assignedAnalystId: analyst.user.id,
      });

      await request(server)
        .post(`${path}/claim`)
        .set('Cookie', analyst.cookie)
        .send({})
        .expect(409);

      const reply = await request(server)
        .post(`${path}/reply`)
        .set('Cookie', analyst.cookie)
        .send({ content: 'Já li o histórico' })
        .expect(201);
      expect(reply.body).toMatchObject({ role: 'analyst', authorName: 'Analista' });

      const messages = await request(server)
        .get(`/api/conversations/${conversation.body.id}/messages`)
        .set('Cookie', ana.cookie)
        .expect(200);
      expect(messages.body).toContainEqual(
        expect.objectContaining({ role: 'analyst', content: 'Já li o histórico' }),
      );

      await request(server)
        .post(`${path}/reply`)
        .set('Cookie', rafael.cookie)
        .send({ content: 'x' })
        .expect(403);
      await request(server)
        .post(`${path}/return`)
        .set('Cookie', rafael.cookie)
        .send({})
        .expect(403);
      await request(server).post(`${path}/close`).set('Cookie', rafael.cookie).send({}).expect(403);

      const returned = await request(server)
        .post(`${path}/return`)
        .set('Cookie', analyst.cookie)
        .send({})
        .expect(201);
      expect(returned.body).toMatchObject({ state: 'agent', assignedAnalystId: null });

      await request(server)
        .post(`${path}/reply`)
        .set('Cookie', analyst.cookie)
        .send({ content: 'late' })
        .expect(403);

      await request(server)
        .post(`/api/conversations/${conversation.body.id}/handoff`)
        .set('Cookie', ana.cookie)
        .send({ reason: 'employee_request' })
        .expect(201);

      await request(server)
        .post(`${path}/claim`)
        .set('Cookie', analyst.cookie)
        .send({})
        .expect(201);
      const closed = await request(server)
        .post(`${path}/close`)
        .set('Cookie', analyst.cookie)
        .send({})
        .expect(201);
      expect(closed.body).toMatchObject({ state: 'closed' });
      expect(closed.body.closedAt).toEqual(expect.any(String));
    } finally {
      await app.close();
      await db.cleanup();
    }
  });

  it('preserves analyst ownership across restart', async () => {
    const db = await createTestDatabase();
    const env = {
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
      databaseUrl: db.url,
    };
    let app = await createApp(env);
    try {
      let server = app.getHttpServer();
      const login = async (email: string) =>
        String(
          (await request(server).post('/api/session').send({ email, password: 'x' }).expect(201))
            .headers['set-cookie']?.[0],
        );
      const ana = await login('ana.souza@nexo.com.br');
      const analyst = await login('analista@nexo.com.br');

      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', ana)
        .send({})
        .expect(201);
      await request(server)
        .post(`/api/conversations/${conversation.body.id}/handoff`)
        .set('Cookie', ana)
        .send({ reason: 'employee_request' })
        .expect(201);
      await request(server)
        .post(`/api/support/conversations/${conversation.body.id}/claim`)
        .set('Cookie', analyst)
        .send({})
        .expect(201);

      await app.close();
      app = await createApp(env);
      server = app.getHttpServer();
      const analystAfterRestart = await login('analista@nexo.com.br');
      const queue = await request(server)
        .get('/api/support/conversations')
        .query({ filter: 'owned' })
        .set('Cookie', analystAfterRestart)
        .expect(200);
      expect(queue.body).toContainEqual(
        expect.objectContaining({ id: conversation.body.id, state: 'with_analyst' }),
      );
    } finally {
      await app.close();
      await db.cleanup();
    }
  });

  it('rejects employee messages on a closed conversation', async () => {
    const db = await createTestDatabase();
    const env = {
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
      databaseUrl: db.url,
    };
    const app = await createApp(env);
    try {
      const server = app.getHttpServer();
      const login = async (email: string) =>
        String(
          (await request(server).post('/api/session').send({ email, password: 'x' }).expect(201))
            .headers['set-cookie']?.[0],
        );
      const ana = await login('ana.souza@nexo.com.br');
      const analyst = await login('analista@nexo.com.br');

      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', ana)
        .send({})
        .expect(201);
      await request(server)
        .post(`/api/conversations/${conversation.body.id}/handoff`)
        .set('Cookie', ana)
        .send({ reason: 'employee_request' })
        .expect(201);
      await request(server)
        .post(`/api/support/conversations/${conversation.body.id}/claim`)
        .set('Cookie', analyst)
        .send({})
        .expect(201);
      await request(server)
        .post(`/api/support/conversations/${conversation.body.id}/close`)
        .set('Cookie', analyst)
        .send({})
        .expect(201);

      await request(server)
        .post(`/api/conversations/${conversation.body.id}/messages/stream`)
        .set('Cookie', ana)
        .send({ content: 'oi' })
        .expect(409);
      const messages = await request(server)
        .get(`/api/conversations/${conversation.body.id}/messages`)
        .set('Cookie', ana)
        .expect(200);
      expect(messages.body).toHaveLength(0);
    } finally {
      await app.close();
      await db.cleanup();
    }
  });
});
