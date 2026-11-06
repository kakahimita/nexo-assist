import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestDatabase } from './support/test-database.js';
import { createDatabaseClient } from '../src/database/client.js';
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

      const overdueMessages = await request(server)
        .get(`/api/conversations/${overdue.body.id}/messages`)
        .set('Cookie', cookie)
        .expect(200);
      expect(
        overdueMessages.body.find((message: { role: string }) => message.role === 'agent').decision
          .tickets[0].status,
      ).toBe('waiting_for_analyst');
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

  it('links the consulted overdue ticket and keeps it in progress after returning', async () => {
    const db = await createTestDatabase();
    const app = await createApp({
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
      databaseUrl: db.url,
      consultationEngine: 'fixture',
    });
    const client = createDatabaseClient(db.url);
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
      const stream = await request(server)
        .post(`/api/conversations/${conversation.body.id}/messages/stream`)
        .set('Cookie', ana)
        .send({ content: 'Notebook lento' })
        .expect(201);
      expect(stream.text).toContain('"type":"handoff-waiting"');
      expect(
        (await client.ticket.findUniqueOrThrow({ where: { id: 'fixture-ana-open' } })).status,
      ).toBe('waiting_for_analyst');

      const detail = await request(server)
        .get(`/api/support/conversations/${conversation.body.id}`)
        .set('Cookie', analyst)
        .expect(200);
      expect(detail.body.conversation.contextTicketId).toBe('fixture-ana-open');

      await request(server)
        .post(`/api/support/conversations/${conversation.body.id}/claim`)
        .set('Cookie', analyst)
        .expect(201);
      expect(
        (await client.ticket.findUniqueOrThrow({ where: { id: 'fixture-ana-open' } })).status,
      ).toBe('in_progress');

      await request(server)
        .post(`/api/support/conversations/${conversation.body.id}/return`)
        .set('Cookie', analyst)
        .expect(201);
      expect(
        (await client.ticket.findUniqueOrThrow({ where: { id: 'fixture-ana-open' } })).status,
      ).toBe('in_progress');
    } finally {
      await client.$disconnect();
      await app.close();
      await db.cleanup();
    }
  });

  it('prefers the newest single-ticket decision over an older link', async () => {
    const db = await createTestDatabase();
    const app = await createApp({
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
      databaseUrl: db.url,
    });
    const client = createDatabaseClient(db.url);
    try {
      const server = app.getHttpServer();
      const ana = String(
        (
          await request(server)
            .post('/api/session')
            .send({ email: 'ana.souza@nexo.com.br', password: 'x' })
            .expect(201)
        ).headers['set-cookie']?.[0],
      );
      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', ana)
        .send({})
        .expect(201);
      const id = conversation.body.id as string;
      await client.conversation.update({
        where: { id },
        data: { contextTicketId: 'fixture-ana-resolved' },
      });
      const decided = {
        id: 'fixture-ana-open',
        number: 'INC-20311',
        title: 'Notebook lento',
        description: 'Lentidão.',
        status: 'open',
        priority: 'medium',
        category: 'hardware',
        createdAt: '2026-10-20T12:00:00.000Z',
        deadline: '2026-10-21T12:00:00.000Z',
        lastUpdate: '2026-10-20T12:00:00.000Z',
        overdue: true,
      };
      await client.message.create({
        data: {
          conversationId: id,
          role: 'agent',
          status: 'completed',
          content: 'Seu chamado está aberto.',
          decision: {
            create: {
              intent: 'Consulta de chamado',
              action: 'answer',
              appliedRule: 'Somente chamados do funcionário',
              confidence: 1,
              justification: 'Chamado identificado.',
              missingFactsJson: '[]',
              quickRepliesJson: '[]',
              actionsJson: '[]',
              evidenceJson: '[]',
              ticketsJson: JSON.stringify([decided]),
              outcome: 'completed',
              errorCode: null,
              source: 'deterministic',
              promptVersion: 'test',
            },
          },
        },
      });
      await request(server)
        .post(`/api/conversations/${id}/handoff`)
        .set('Cookie', ana)
        .send({ reason: 'employee_request' })
        .expect(201);
      expect((await client.conversation.findUniqueOrThrow({ where: { id } })).contextTicketId).toBe(
        'fixture-ana-open',
      );
      expect(
        (await client.ticket.findUniqueOrThrow({ where: { id: 'fixture-ana-open' } })).status,
      ).toBe('waiting_for_analyst');
      expect(
        (await client.ticket.findUniqueOrThrow({ where: { id: 'fixture-ana-resolved' } })).status,
      ).toBe('resolved');
    } finally {
      await client.$disconnect();
      await app.close();
      await db.cleanup();
    }
  });
});
