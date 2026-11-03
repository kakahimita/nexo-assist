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
});
