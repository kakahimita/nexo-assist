import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createDatabaseClient } from '../src/database/client.js';
import { createTestDatabase } from './support/test-database.js';

describe('B01 B13 B16: authorized persistent history', () => {
  it('isolates employees and restores history after restart', async () => {
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
      async function login(email: string): Promise<string> {
        const result = await request(server)
          .post('/api/session')
          .send({ email, password: 'x' })
          .expect(201);
        return String(result.headers['set-cookie']?.[0]);
      }
      const ana = await login('ana.souza@nexo.com.br');
      const bruno = await login('bruno.lima@nexo.com.br');
      const analyst = await login('analista@nexo.com.br');
      await request(server)
        .post('/api/conversations')
        .set('Cookie', ana)
        .set('Origin', 'http://localhost:4000')
        .type('form')
        .send({})
        .expect(403);
      await request(server).get('/api/conversations').expect(401);
      await request(server).get('/api/conversations').set('Cookie', analyst).expect(403);
      await request(server)
        .post('/api/conversations')
        .set('Cookie', ana)
        .send({ ownerId: 'forged' })
        .expect(400);
      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', ana)
        .send({})
        .expect(201);
      expect(conversation.body.flow).toEqual({ mode: 'none', stage: 'idle', facts: {} });
      const path = `/api/conversations/${conversation.body.id}/messages`;
      const employee = await request(server)
        .post(path)
        .set('Cookie', ana)
        .send({ content: 'Olá' })
        .expect(201);
      expect(employee.body).toMatchObject({
        role: 'employee',
        status: 'completed',
        decision: null,
      });
      const client = createDatabaseClient(db.url);
      try {
        await client.message.create({
          data: {
            conversationId: conversation.body.id,
            content: 'Resposta',
            role: 'agent',
            status: 'completed',
            decision: {
              create: {
                intent: 'VPN',
                action: 'answer',
                appliedRule: 'IT',
                confidence: 0.8,
                justification: 'Artigo',
                missingFactsJson: '[]',
                quickRepliesJson: '[]',
                actionsJson:
                  '[{"id":"1","tool":"search-knowledge","status":"succeeded","label":"Busca","summary":"Encontrado"}]',
                evidenceJson: '[{"kind":"article","id":"kb-1","title":"VPN"}]',
                ticketsJson: '[]',
                outcome: 'completed',
                source: 'deterministic',
                promptVersion: 'consultation-v1',
              },
            },
          },
        });
      } finally {
        await client.$disconnect();
      }
      await request(server).post(path).set('Cookie', ana).send({ content: ' ' }).expect(400);
      await request(server)
        .post(path)
        .set('Cookie', ana)
        .send({ content: 'x', role: 'analyst' })
        .expect(400);
      expect(
        (await request(server).get('/api/conversations').set('Cookie', bruno).expect(200)).body,
      ).toEqual([]);
      await request(server).get(path).set('Cookie', bruno).expect(404);
      await request(server).post(path).set('Cookie', bruno).send({ content: 'x' }).expect(404);
      await app.close();
      app = await createApp(env);
      server = app.getHttpServer();
      expect(
        (await request(server).get('/api/conversations').set('Cookie', ana).expect(200)).body,
      ).toEqual([
        expect.objectContaining({
          id: conversation.body.id,
          flow: { mode: 'none', stage: 'idle', facts: {} },
        }),
      ]);
      const messages = (await request(server).get(path).set('Cookie', ana).expect(200)).body;
      expect(messages).toHaveLength(2);
      expect(messages[1]).toMatchObject({
        role: 'agent',
        status: 'completed',
        decision: {
          confidence: 0.8,
          source: 'deterministic',
          actions: [{ tool: 'search-knowledge' }],
          evidence: [{ id: 'kb-1' }],
          tickets: [],
        },
      });
      expect(messages[0].content).toBe('Olá');
    } finally {
      await app.close();
      await db.cleanup();
    }
  });
  it('restores a stored ticket decision that predates category and creation metadata', async () => {
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
      const login = await request(server)
        .post('/api/session')
        .send({ email: 'ana.souza@nexo.com.br', password: 'x' })
        .expect(201);
      const cookie = String(login.headers['set-cookie']?.[0]);
      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', cookie)
        .send({})
        .expect(201);
      const path = `/api/conversations/${conversation.body.id}/messages`;
      const client = createDatabaseClient(db.url);
      try {
        await client.message.create({
          data: {
            conversationId: conversation.body.id,
            content: 'O chamado está aberto.',
            role: 'agent',
            status: 'completed',
            decision: {
              create: {
                intent: 'Consulta de chamado',
                action: 'answer',
                appliedRule: 'Somente chamados do funcionário',
                confidence: 0.8,
                justification: 'Chamado identificado.',
                missingFactsJson: '[]',
                quickRepliesJson: '[]',
                actionsJson: '[]',
                evidenceJson: '[]',
                ticketsJson:
                  '[{"id":"INC-legacy","title":"Notebook antigo","status":"open","priority":"medium","deadline":"2026-11-07T12:00:00.000Z","lastUpdate":"2026-10-21T12:00:00.000Z","overdue":false}]',
                outcome: 'completed',
                source: 'deterministic',
                promptVersion: 'consultation-v1',
              },
            },
          },
        });
      } finally {
        await client.$disconnect();
      }
      await app.close();
      app = await createApp(env);
      server = app.getHttpServer();
      const messages = (await request(server).get(path).set('Cookie', cookie).expect(200)).body;
      expect(messages).toHaveLength(1);
      expect(messages[0].decision.tickets).toEqual([
        expect.objectContaining({
          id: 'INC-legacy',
          category: null,
          createdAt: null,
        }),
      ]);
    } finally {
      await app.close();
      await db.cleanup();
    }
  });
  it('lists only the employee conversation summary and its context ticket number', async () => {
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
      const anaLogin = await request(server)
        .post('/api/session')
        .send({ email: 'ana.souza@nexo.com.br', password: 'x' })
        .expect(201);
      const brunoLogin = await request(server)
        .post('/api/session')
        .send({ email: 'bruno.lima@nexo.com.br', password: 'x' })
        .expect(201);
      const anaCookie = String(anaLogin.headers['set-cookie']?.[0]);
      const brunoCookie = String(brunoLogin.headers['set-cookie']?.[0]);
      const anaConversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', anaCookie)
        .send({})
        .expect(201);
      await request(server)
        .post(`/api/conversations/${anaConversation.body.id}/messages`)
        .set('Cookie', anaCookie)
        .send({ content: 'Meu notebook não liga.' })
        .expect(201);
      const brunoConversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', brunoCookie)
        .send({})
        .expect(201);
      await request(server)
        .post(`/api/conversations/${brunoConversation.body.id}/messages`)
        .set('Cookie', brunoCookie)
        .send({ content: 'Mensagem privada do Bruno.' })
        .expect(201);
      const client = createDatabaseClient(db.url);
      try {
        const ana = await client.user.findUniqueOrThrow({
          where: { email: 'ana.souza@nexo.com.br' },
        });
        const ticket = await client.ticket.create({
          data: {
            number: 20393,
            ownerId: ana.id,
            title: 'Notebook não liga',
            normalizedTitle: 'notebook nao liga',
            description: 'O notebook não liga.',
            type: 'INC',
            category: 'hardware',
            priority: 'high',
            impact: 'self',
            slaStartedAt: new Date('2026-11-07T12:00:00.000Z'),
          },
        });
        await client.conversation.update({
          where: { id: anaConversation.body.id },
          data: { contextTicketId: ticket.id },
        });
      } finally {
        await client.$disconnect();
      }
      expect(
        (await request(server).get('/api/conversations').set('Cookie', anaCookie).expect(200)).body,
      ).toEqual([
        expect.objectContaining({
          id: anaConversation.body.id,
          latestMessage: expect.objectContaining({
            content: 'Meu notebook não liga.',
            role: 'employee',
          }),
          contextTicketNumber: 'INC-20393',
        }),
      ]);
    } finally {
      await app.close();
      await db.cleanup();
    }
  });
  it('does not let a new conversation bypass an employee handoff', async () => {
    const db = await createTestDatabase();
    const app = await createApp({
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
      databaseUrl: db.url,
    });
    try {
      const server = app.getHttpServer();
      const login = await request(server)
        .post('/api/session')
        .send({ email: 'ana.souza@nexo.com.br', password: 'x' })
        .expect(201);
      const cookie = String(login.headers['set-cookie']?.[0]);
      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', cookie)
        .send({})
        .expect(201);
      await request(server)
        .post(`/api/conversations/${conversation.body.id}/handoff`)
        .set('Cookie', cookie)
        .send({ reason: 'employee_request' })
        .expect(201);
      await request(server).post('/api/conversations').set('Cookie', cookie).send({}).expect(409);
    } finally {
      await app.close();
      await db.cleanup();
    }
  });
});
