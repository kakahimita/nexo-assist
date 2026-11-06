import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestDatabase } from './support/test-database.js';
import { createDatabaseClient } from '../src/database/client.js';

describe('B04: collect missing facts before proposing a ticket draft', () => {
  it('asks before dismissing a possible match and lets the employee review a different problem', async () => {
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
      const path = `/api/conversations/${conversation.body.id}/messages/stream`;
      const turn = async (content: string) => {
        const response = await request(server)
          .post(path)
          .set('Cookie', cookie)
          .send({ content })
          .expect(201);
        return response.text
          .split('\n\n')
          .filter(Boolean)
          .map((chunk) => JSON.parse(chunk.slice(6)))
          .at(-1).message;
      };
      for (const content of [
        'Abrir chamado: Computador portátil devagar',
        'Somente eu',
        'Consigo trabalhar com alternativa',
      ])
        await turn(content);
      const candidates = await turn('Sem compromisso em risco hoje');
      expect(candidates.decision.draftId).toBeNull();
      expect(candidates.decision.tickets.map((ticket: { id: string }) => ticket.id)).toContain(
        'fixture-ana-open',
      );
      expect(candidates.decision.quickReplies).toContain('São outros problemas');
      const final = await turn('São outros problemas');
      expect(final.decision.draftId).toEqual(expect.any(String));
      const draft = (
        await request(server)
          .get(`/api/ticket-drafts/${final.decision.draftId}`)
          .set('Cookie', cookie)
          .expect(200)
      ).body;
      expect(draft.candidates.map((ticket: { id: string }) => ticket.id)).toContain(
        'fixture-ana-open',
      );
      expect(await client.ticket.count()).toBe(3);
    } finally {
      await app.close();
      await client.$disconnect();
      await db.cleanup();
    }
  });
  it('accepts a later problem description when the opening request had no details', async () => {
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
      const path = `/api/conversations/${conversation.body.id}/messages/stream`;
      const turn = async (content: string) => {
        const response = await request(server)
          .post(path)
          .set('Cookie', cookie)
          .send({ content })
          .expect(201);
        return response.text
          .split('\n\n')
          .filter(Boolean)
          .map((chunk) => JSON.parse(chunk.slice(6)))
          .at(-1).message;
      };
      for (const content of ['Abrir chamado', 'Somente eu', 'Consigo trabalhar com alternativa'])
        await turn(content);
      expect((await turn('Sem compromisso em risco hoje')).decision.missingFacts).toContain(
        'descrição',
      );
      expect(await client.ticketDraft.count()).toBe(0);
      const final = await turn('Meu projetor não liga');
      expect(final.decision.draftId).toEqual(expect.any(String));
    } finally {
      await app.close();
      await client.$disconnect();
      await db.cleanup();
    }
  });
  it('offers an owned duplicate for selection and proposes a supplement instead of creating a ticket', async () => {
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
      const path = `/api/conversations/${conversation.body.id}/messages/stream`;
      const turn = async (content: string) => {
        const response = await request(server)
          .post(path)
          .set('Cookie', cookie)
          .send({ content })
          .expect(201);
        return response.text
          .split('\n\n')
          .filter(Boolean)
          .map((chunk) => JSON.parse(chunk.slice(6)))
          .at(-1).message;
      };
      await client.ticket.update({
        where: { id: 'fixture-ana-open' },
        data: { slaStartedAt: new Date() },
      });
      const before = await client.ticket.count();
      for (const content of [
        'Abrir chamado: Notebook lento',
        'Somente eu',
        'Consigo trabalhar com alternativa',
      ])
        await turn(content);
      const match = await turn('Sem compromisso em risco hoje');
      expect(match.decision.draftId).toBeNull();
      expect(match.decision.tickets.map((ticket: { id: string }) => ticket.id)).toContain(
        'fixture-ana-open',
      );
      expect((await turn('Notebook lento')).decision.missingFacts).toContain(
        'informações adicionais',
      );
      const proposal = await turn('Também reinicia sozinho');
      expect(proposal.decision.draftId).toEqual(expect.any(String));
      const draft = (
        await request(server)
          .get(`/api/ticket-drafts/${proposal.decision.draftId}`)
          .set('Cookie', cookie)
          .expect(200)
      ).body;
      expect(draft.input).toMatchObject({
        action: 'supplement',
        ticketId: 'fixture-ana-open',
        content: 'Também reinicia sozinho',
      });
      expect(await client.ticket.count()).toBe(before);
    } finally {
      await app.close();
      await client.$disconnect();
      await db.cleanup();
    }
  });
  it('proposes a supplement and reopening for an owned ticket without writing before confirmation', async () => {
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
      const path = `/api/conversations/${conversation.body.id}/messages/stream`;
      const turn = async (content: string) => {
        const response = await request(server)
          .post(path)
          .set('Cookie', cookie)
          .send({ content })
          .expect(201);
        return response.text
          .split('\n\n')
          .filter(Boolean)
          .map((chunk) => JSON.parse(chunk.slice(6)))
          .at(-1).message;
      };
      await client.ticket.update({
        where: { id: 'fixture-ana-open' },
        data: { slaStartedAt: new Date() },
      });
      const before = await client.ticketEvent.count();
      expect((await turn('Complementar chamado: Notebook lento')).decision.missingFacts).toContain(
        'informações adicionais',
      );
      const supplement = await turn('Também reinicia sozinho');
      expect(supplement.decision.draftId).toEqual(expect.any(String));
      expect(await client.ticketEvent.count()).toBe(before);
      const draft = (
        await request(server)
          .get(`/api/ticket-drafts/${supplement.decision.draftId}`)
          .set('Cookie', cookie)
          .expect(200)
      ).body;
      expect(draft.input).toMatchObject({
        action: 'supplement',
        ticketId: 'fixture-ana-open',
        content: 'Também reinicia sozinho',
      });
      expect(draft.ticket).toMatchObject({
        id: 'fixture-ana-open',
        number: 'INC-20311',
        status: 'open',
      });
      await request(server)
        .post(`/api/ticket-drafts/${draft.id}/confirm`)
        .set('Cookie', cookie)
        .send({ version: draft.version, operationId: draft.operationId })
        .expect(201);
      expect((await turn('Reabrir chamado: Senha bloqueada')).decision.missingFacts).toContain(
        'motivo',
      );
      const reopen = await turn('O problema voltou');
      expect(reopen.decision.draftId).toEqual(expect.any(String));
      const second = (
        await request(server)
          .get(`/api/ticket-drafts/${reopen.decision.draftId}`)
          .set('Cookie', cookie)
          .expect(200)
      ).body;
      expect(second.input).toMatchObject({
        action: 'reopen',
        ticketId: 'fixture-ana-resolved',
        reason: 'O problema voltou',
      });
      await request(server)
        .post(`/api/ticket-drafts/${second.id}/confirm`)
        .set('Cookie', cookie)
        .send({ version: second.version, operationId: second.operationId })
        .expect(201);
      expect(
        (await client.ticket.findUniqueOrThrow({ where: { id: 'fixture-ana-resolved' } })).status,
      ).toBe('open');
    } finally {
      await app.close();
      await client.$disconnect();
      await db.cleanup();
    }
  });
  it('asks for impact, work state and urgency over multiple turns and waits for confirmation', async () => {
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
      const path = `/api/conversations/${conversation.body.id}/messages/stream`;
      const turn = async (content: string) => {
        const response = await request(server)
          .post(path)
          .set('Cookie', cookie)
          .send({ content })
          .expect(201);
        return response.text
          .split('\n\n')
          .filter(Boolean)
          .map((chunk) => JSON.parse(chunk.slice(6)))
          .at(-1).message;
      };
      const before = await client.ticket.count();
      const first = await turn('Abrir chamado: Meu notebook não liga');
      expect(first.decision.missingFacts).toContain('impacto');
      expect(await client.ticketDraft.count()).toBe(0);
      const second = await turn('Somente eu');
      expect(second.decision.missingFacts).toContain('situação do trabalho');
      expect(await client.ticketDraft.count()).toBe(0);
      const third = await turn('Consigo trabalhar com alternativa');
      expect(third.decision.missingFacts).toContain('urgência');
      expect(await client.ticketDraft.count()).toBe(0);
      const final = await turn('Sem compromisso em risco hoje');
      expect(final.decision.draftId).toEqual(expect.any(String));
      expect(await client.ticket.count()).toBe(before);
      const draft = (
        await request(server)
          .get(`/api/ticket-drafts/${final.decision.draftId}`)
          .set('Cookie', cookie)
          .expect(200)
      ).body;
      expect(draft.input).toMatchObject({
        impact: 'self',
        workState: 'workaround',
        urgency: 'normal',
      });
      await request(server)
        .post(`/api/ticket-drafts/${draft.id}/confirm`)
        .set('Cookie', cookie)
        .send({ version: draft.version, operationId: draft.operationId })
        .expect(201);
      expect(await client.ticket.count()).toBe(before + 1);
    } finally {
      await app.close();
      await client.$disconnect();
      await db.cleanup();
    }
  });
});
