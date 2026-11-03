import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestDatabase } from './support/test-database.js';
import type { ConsultationEngine } from '../src/agent/consultation/types.js';

describe('B09 B10 B13 B16: durable employee handoff', () => {
  it('persists an unresolved engine decision as a waiting handoff', async () => {
    const db = await createTestDatabase();
    let calls = 0;
    const engine: ConsultationEngine = {
      source: 'deterministic',
      promptVersion: 'test',
      async *run() {
        calls += 1;
        yield { type: 'handoff', reason: 'unresolved_uncertainty' };
      },
    };
    const app = await createApp(
      { host: '127.0.0.1', port: 3001, webOrigin: 'http://localhost:3000', databaseUrl: db.url },
      { consultationEngine: engine },
    );
    try {
      const server = app.getHttpServer();
      const cookie = String(
        (
          await request(server)
            .post('/api/session')
            .send({ email: 'ana.souza@nexo.com.br', password: 'x' })
            .expect(201)
        ).headers['set-cookie']?.[0],
      );
      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', cookie)
        .send({})
        .expect(201);
      const stream = await request(server)
        .post(`/api/conversations/${conversation.body.id}/messages/stream`)
        .set('Cookie', cookie)
        .send({ content: 'Não sei explicar o problema' })
        .expect(201);
      expect(stream.text).toContain('"type":"handoff-waiting"');
      const conversations = await request(server)
        .get('/api/conversations')
        .set('Cookie', cookie)
        .expect(200);
      expect(conversations.body).toContainEqual(
        expect.objectContaining({
          id: conversation.body.id,
          state: 'waiting_for_analyst',
          handoff: expect.objectContaining({ reason: 'unresolved_uncertainty' }),
        }),
      );
      const waiting = await request(server)
        .post(`/api/conversations/${conversation.body.id}/messages/stream`)
        .set('Cookie', cookie)
        .send({ content: 'Ainda preciso de ajuda' })
        .expect(201);
      expect(waiting.text).toContain('"type":"handoff-waiting"');
      expect(calls).toBe(1);
      const history = await request(server)
        .get(`/api/conversations/${conversation.body.id}/messages`)
        .set('Cookie', cookie)
        .expect(200);
      expect(history.body).toEqual([
        expect.objectContaining({ role: 'employee', content: 'Não sei explicar o problema' }),
        expect.objectContaining({ role: 'employee', content: 'Ainda preciso de ajuda' }),
      ]);
    } finally {
      await app.close();
      await db.cleanup();
    }
  });
  it('automatically requests human support for overdue tickets and critical incidents', async () => {
    const db = await createTestDatabase();
    const app = await createApp({
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
      databaseUrl: db.url,
      consultationEngine: 'fixture',
    });
    try {
      const server = app.getHttpServer();
      const cookie = String(
        (
          await request(server)
            .post('/api/session')
            .send({ email: 'ana.souza@nexo.com.br', password: 'x' })
            .expect(201)
        ).headers['set-cookie']?.[0],
      );
      const createConversation = () =>
        request(server).post('/api/conversations').set('Cookie', cookie).send({}).expect(201);
      const stream = (conversationId: string, content: string) =>
        request(server)
          .post(`/api/conversations/${conversationId}/messages/stream`)
          .set('Cookie', cookie)
          .send({ content })
          .expect(201);

      const overdue = await createConversation();
      const overdueResponse = await stream(overdue.body.id, 'Notebook lento');
      expect(overdueResponse.text).toContain('"type":"handoff-waiting"');

      const critical = await createConversation();
      await stream(critical.body.id, 'Abrir chamado: notebook não funciona');
      await stream(critical.body.id, 'Minha equipe');
      await stream(critical.body.id, 'Não consigo trabalhar');
      const criticalResponse = await stream(critical.body.id, 'Compromisso em risco hoje');
      expect(criticalResponse.text).toContain('"type":"handoff-waiting"');

      const conversations = await request(server)
        .get('/api/conversations')
        .set('Cookie', cookie)
        .expect(200);
      expect(
        conversations.body.find((item: { id: string }) => item.id === overdue.body.id),
      ).toMatchObject({
        state: 'waiting_for_analyst',
        handoff: { reason: 'overdue_ticket' },
      });
      expect(
        conversations.body.find((item: { id: string }) => item.id === critical.body.id),
      ).toMatchObject({
        state: 'waiting_for_analyst',
        handoff: { reason: 'critical_incident' },
      });
    } finally {
      await app.close();
      await db.cleanup();
    }
  });
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
