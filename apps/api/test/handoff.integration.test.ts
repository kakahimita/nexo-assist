import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestDatabase } from './support/test-database.js';

describe('B09 B10 B13 B16: durable employee handoff', () => {
  it('persists an employee-requested handoff without accepting forged metadata', async () => {
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
      const bruno = await login('bruno.lima@nexo.com.br');
      const analyst = await login('analista@nexo.com.br');
      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', ana)
        .send({})
        .expect(201);
      const path = `/api/conversations/${conversation.body.id}/handoff`;

      const handoff = await request(server)
        .post(path)
        .set('Cookie', ana)
        .send({ reason: 'employee_request' })
        .expect(201);
      expect(handoff.body).toMatchObject({
        id: conversation.body.id,
        state: 'waiting_for_analyst',
        stateVersion: 1,
        handoff: { reason: 'employee_request' },
      });
      expect(handoff.body.handoff.summary).toEqual(expect.any(String));
      expect(handoff.body.handoff.summary).not.toBe('');
      expect(handoff.body.handoff.requestedAt).toEqual(expect.any(String));

      await request(server)
        .post(path)
        .set('Cookie', ana)
        .send({ reason: 'employee_request' })
        .expect(409);
      await request(server)
        .post(path)
        .set('Cookie', bruno)
        .send({ reason: 'employee_request' })
        .expect(404);
      await request(server)
        .post(path)
        .set('Cookie', analyst)
        .send({ reason: 'employee_request' })
        .expect(403);
      await request(server)
        .post(path)
        .set('Cookie', ana)
        .send({ reason: 'employee_request', summary: 'forged' })
        .expect(400);

      await app.close();
      app = await createApp(env);
      server = app.getHttpServer();
      const afterRestart = await request(server)
        .get('/api/conversations')
        .set('Cookie', ana)
        .expect(200);
      expect(afterRestart.body).toContainEqual(
        expect.objectContaining({
          id: conversation.body.id,
          state: 'waiting_for_analyst',
          stateVersion: 1,
          handoff: expect.objectContaining({ reason: 'employee_request' }),
        }),
      );
      await request(server).post('/api/conversations').set('Cookie', ana).send({}).expect(201);
      const persisted = await request(server)
        .get('/api/conversations')
        .set('Cookie', ana)
        .expect(200);
      expect(
        persisted.body.find((item: { id: string }) => item.id === conversation.body.id),
      ).toMatchObject({
        state: 'waiting_for_analyst',
        stateVersion: 1,
      });
    } finally {
      await app.close();
      await db.cleanup();
    }
  });
});
