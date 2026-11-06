import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createDatabaseClient } from '../src/database/client.js';
import { createTestDatabase } from './support/test-database.js';

it('publishes historical aggregates and enforces explicit resolution and expiring analyst presence', async () => {
  const db = await createTestDatabase();
  const client = createDatabaseClient(db.url);
  const app = await createApp({
    host: '127.0.0.1',
    port: 3001,
    webOrigin: 'http://localhost:3000',
    databaseUrl: db.url,
  });
  const server = app.getHttpServer();
  async function login(email: string) {
    const response = await request(server)
      .post('/api/session')
      .send({ email, password: 'demo' })
      .expect(201);
    return String(response.headers['set-cookie']?.[0]);
  }
  try {
    const empty = await request(server).get('/api/metrics').expect(200);
    expect(empty.body).toMatchObject({
      firstResponseSeconds: null,
      responseSamples: 0,
      resolutionPercent: null,
      concludedConversations: 0,
      onlineAnalysts: 0,
    });
    const employee = await login('ana.souza@nexo.com.br');
    const other = await login('bruno.lima@nexo.com.br');
    const analyst = await login('analista@nexo.com.br');
    const analystAgain = await login('analista@nexo.com.br');
    await request(server).post('/api/session/presence').expect(401);
    await request(server)
      .post('/api/session/presence')
      .set('Cookie', employee)
      .send({})
      .expect(403);
    await request(server)
      .post('/api/session/presence')
      .set('Cookie', analyst)
      .send({ userId: 'forged' })
      .expect(400);
    for (const cookie of [analyst, analystAgain])
      await request(server)
        .post('/api/session/presence')
        .set('Cookie', cookie)
        .send({})
        .expect(204);
    expect((await request(server).get('/api/metrics')).body.onlineAnalysts).toBe(1);
    await client.session.updateMany({ data: { lastSeenAt: new Date(Date.now() - 61_000) } });
    expect((await request(server).get('/api/metrics')).body.onlineAnalysts).toBe(0);
    await request(server).post('/api/session/presence').set('Cookie', analyst).send({}).expect(204);
    await request(server).delete('/api/session').set('Cookie', analyst).expect(204);
    expect((await request(server).get('/api/metrics')).body.onlineAnalysts).toBe(0);

    const user = await client.user.findUniqueOrThrow({ where: { email: 'ana.souza@nexo.com.br' } });
    async function conversation(seconds: number, source = 'live') {
      const row = await client.conversation.create({ data: { ownerId: user.id } });
      await client.message.create({
        data: {
          conversationId: row.id,
          content: 'TI',
          createdAt: new Date('2025-01-01T00:00:00Z'),
        },
      });
      const reply = await client.message.create({
        data: {
          conversationId: row.id,
          role: 'agent',
          content: 'Orientação',
          createdAt: new Date(Date.parse('2025-01-01T00:00:00Z') + seconds * 1000),
          decision: {
            create: {
              intent: 'knowledge',
              action: 'answer',
              appliedRule: 'knowledge',
              confidence: 1,
              justification: 'Article',
              missingFactsJson: '[]',
              quickRepliesJson: '[]',
              actionsJson: '[]',
              evidenceJson: '[]',
              ticketsJson: '[]',
              outcome: 'completed',
              source,
              promptVersion: 'test',
            },
          },
        },
      });
      return { row, reply };
    }
    const first = await conversation(2);
    const second = await conversation(6);
    await conversation(200, 'deterministic');
    const failed = await conversation(100);
    await client.message.update({ where: { id: failed.reply.id }, data: { status: 'failed' } });
    const resolvePath = `/api/conversations/${first.row.id}/resolution`;
    const body = { messageId: first.reply.id };
    await request(server).post(resolvePath).set('Cookie', other).send(body).expect(404);
    await request(server).post(resolvePath).set('Cookie', analystAgain).send(body).expect(403);
    await request(server)
      .post(resolvePath)
      .set('Cookie', employee)
      .send({ messageId: 'stale' })
      .expect(409);
    const newer = await client.message.create({
      data: { conversationId: first.row.id, content: 'Ainda estou verificando' },
    });
    await request(server).post(resolvePath).set('Cookie', employee).send(body).expect(409);
    await client.message.delete({ where: { id: newer.id } });
    await request(server).post(resolvePath).set('Cookie', employee).send(body).expect(201);
    await request(server).post(resolvePath).set('Cookie', employee).send(body).expect(201);
    expect(await client.conversation.findUnique({ where: { id: first.row.id } })).toMatchObject({
      state: 'closed',
      stateVersion: 1,
      resolvedByAgentMessageId: first.reply.id,
    });
    await request(server)
      .post(`/api/conversations/${second.row.id}/handoff`)
      .set('Cookie', employee)
      .send({ reason: 'employee_request' })
      .expect(201);
    await request(server)
      .post(`/api/conversations/${second.row.id}/resolution`)
      .set('Cookie', employee)
      .send({ messageId: second.reply.id })
      .expect(409);
    const result = await request(server).get('/api/metrics').expect(200);
    expect(result.body).toMatchObject({
      firstResponseSeconds: 4,
      responseSamples: 2,
      resolutionPercent: 50,
      resolvedWithoutQueue: 1,
      concludedConversations: 2,
      onlineAnalysts: 0,
    });
    expect(result.text).not.toContain(user.email);
    expect(result.headers['cache-control']).toContain('no-store');
    await request(server)
      .post(`/api/conversations/${first.row.id}/messages`)
      .set('Cookie', employee)
      .send({ content: 'Outro problema' })
      .expect(409);
    await client.session.updateMany({ data: { expiresAt: new Date(0), lastSeenAt: new Date() } });
    await request(server)
      .post('/api/session/presence')
      .set('Cookie', analystAgain)
      .send({})
      .expect(401);
    expect((await request(server).get('/api/metrics')).body.onlineAnalysts).toBe(0);
  } finally {
    await client.$disconnect();
    await app.close();
    await db.cleanup();
  }
});
