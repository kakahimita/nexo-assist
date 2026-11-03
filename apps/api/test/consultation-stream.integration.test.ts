import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestDatabase } from './support/test-database.js';
import { createDatabaseClient } from '../src/database/client.js';
import type { ConsultationEngine } from '../src/agent/consultation/types.js';

const events = (text: string) =>
  text
    .split('\n\n')
    .filter(Boolean)
    .map((part) => JSON.parse(part.slice(6)));
describe('B02/B03/B12/B13/B15/B16: authenticated consultation stream', () => {
  it('discards a late agent answer after an employee handoff', async () => {
    const db = await createTestDatabase();
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const engine: ConsultationEngine = {
      source: 'deterministic',
      promptVersion: 'test',
      async *run() {
        yield { type: 'text-delta', text: 'Parcial' };
        await gate;
        yield {
          type: 'decision',
          decision: {
            intent: 'Teste',
            action: 'answer',
            appliedRule: 'IT',
            confidence: 1,
            justification: 'Teste',
            missingFacts: [],
            quickReplies: [],
          },
        };
        yield { type: 'finish' };
      },
    };
    const app = await createApp(
      { host: '127.0.0.1', port: 3001, webOrigin: 'http://localhost:3000', databaseUrl: db.url },
      { consultationEngine: engine },
    );
    try {
      await app.listen(0, '127.0.0.1');
      const server = app.getHttpServer();
      const auth = await request(server)
        .post('/api/session')
        .send({ email: 'ana.souza@nexo.com.br', password: 'x' })
        .expect(201);
      const cookie = String(auth.headers['set-cookie']?.[0]).split(';')[0]!;
      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', cookie)
        .send({})
        .expect(201);
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing server address');
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/conversations/${conversation.body.id}/messages/stream`,
        {
          method: 'POST',
          headers: { cookie, 'content-type': 'application/json' },
          body: JSON.stringify({ content: 'Preciso de ajuda' }),
        },
      );
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (!text.includes('Parcial')) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error('Stream ended before partial text');
        text += decoder.decode(chunk.value);
      }
      await request(server)
        .post(`/api/conversations/${conversation.body.id}/handoff`)
        .set('Cookie', cookie)
        .send({ reason: 'employee_request' })
        .expect(201);
      release();
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        text += decoder.decode(chunk.value);
      }
      expect(text).toContain('"type":"handoff-waiting"');
      const history = await request(server)
        .get(`/api/conversations/${conversation.body.id}/messages`)
        .set('Cookie', cookie)
        .expect(200);
      expect(history.body).toHaveLength(1);
      expect(history.body[0]).toMatchObject({ role: 'employee', content: 'Preciso de ajuda' });
    } finally {
      release();
      await app.close();
      await db.cleanup();
    }
  });
  it('checks authorization and persists actual decisions through restart', async () => {
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
      async function login(email: string) {
        const response = await request(server)
          .post('/api/session')
          .send({ email, password: 'x' })
          .expect(201);
        return String(response.headers['set-cookie']?.[0]);
      }
      const ana = await login('ana.souza@nexo.com.br');
      const bruno = await login('bruno.lima@nexo.com.br');
      const analyst = await login('analista@nexo.com.br');
      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', ana)
        .send({})
        .expect(201);
      const path = `/api/conversations/${conversation.body.id}/messages/stream`;
      await request(server).post(path).send({ content: 'x' }).expect(401);
      await request(server).post(path).set('Cookie', analyst).send({ content: 'x' }).expect(403);
      await request(server).post(path).set('Cookie', bruno).send({ content: 'x' }).expect(404);
      for (const body of [
        { content: '' },
        { content: 'x'.repeat(4001) },
        { content: 'x', ownerId: 'forged' },
      ])
        await request(server).post(path).set('Cookie', ana).send(body).expect(400);
      const before = await Promise.all([
        client.ticket.count(),
        client.ticketDraft.count(),
        client.ticketEvent.count(),
      ]);
      const response = await request(server)
        .post(path)
        .set('Cookie', ana)
        .send({ content: 'VPN erro 809 Windows 11' })
        .expect(201);
      expect(response.headers['content-type']).toContain('text/event-stream');
      const parts = events(response.text);
      expect(parts[0].type).toBe('user-message');
      expect(parts.filter((item) => item.type === 'text-delta').length).toBeGreaterThanOrEqual(2);
      expect(parts.at(-1).type).toBe('done');
      const agent = parts.at(-1).message;
      expect(agent).toMatchObject({
        role: 'agent',
        status: 'completed',
        decision: { source: 'deterministic', outcome: 'completed' },
      });
      expect(agent.decision.evidence).toContainEqual(
        expect.objectContaining({ id: 'kb-vpn-809-windows-11' }),
      );
      expect(agent.decision.evidence).not.toContainEqual(
        expect.objectContaining({ id: 'kb-vpn-809-windows-10' }),
      );
      expect(
        agent.decision.actions.some(
          (action: { tool: string }) => action.tool === 'consult-tickets',
        ),
      ).toBe(true);
      await app.close();
      app = await createApp(env);
      server = app.getHttpServer();
      const history = await request(server)
        .get(`/api/conversations/${conversation.body.id}/messages`)
        .set('Cookie', ana)
        .expect(200);
      expect(history.body).toHaveLength(2);
      expect(history.body[1]).toEqual(agent);
      expect(
        await Promise.all([
          client.ticket.count(),
          client.ticketDraft.count(),
          client.ticketEvent.count(),
        ]),
      ).toEqual(before);
    } finally {
      await app.close();
      await client.$disconnect();
      await db.cleanup();
    }
  });
  it('streams before completion and sends persisted history to the engine', async () => {
    const db = await createTestDatabase();
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let received: Array<{ role: string; content: string }> = [];
    const engine: ConsultationEngine = {
      source: 'deterministic',
      promptVersion: 'test',
      async *run(input) {
        received = input.messages;
        yield { type: 'text-delta', text: 'Parcial' };
        await gate;
        yield {
          type: 'decision',
          decision: {
            intent: 'Teste',
            action: 'answer',
            appliedRule: 'IT',
            confidence: 0.8,
            justification: 'Teste',
            missingFacts: [],
            quickReplies: [],
          },
        };
        yield { type: 'finish' };
      },
    };
    const env = {
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
      databaseUrl: db.url,
    };
    const app = await createApp(env, { consultationEngine: engine });
    try {
      await app.listen(0, '127.0.0.1');
      const server = app.getHttpServer();
      const auth = await request(server)
        .post('/api/session')
        .send({ email: 'ana.souza@nexo.com.br', password: 'x' })
        .expect(201);
      const cookie = String(auth.headers['set-cookie']?.[0]).split(';')[0]!;
      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', cookie)
        .send({})
        .expect(201);
      const path = `/api/conversations/${conversation.body.id}/messages`;
      await request(server)
        .post(path)
        .set('Cookie', cookie)
        .send({ content: 'Antes 1' })
        .expect(201);
      await request(server)
        .post(path)
        .set('Cookie', cookie)
        .send({ content: 'Antes 2' })
        .expect(201);
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing server address');
      const response = await fetch(`http://127.0.0.1:${address.port}${path}/stream`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'Agora' }),
      });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (!text.includes('Parcial')) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error('Stream ended before partial text');
        text += decoder.decode(chunk.value);
      }
      expect(received.map((message) => message.content)).toEqual(['Antes 1', 'Antes 2', 'Agora']);
      release();
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        text += decoder.decode(chunk.value);
      }
      expect(text).toContain('"type":"done"');
    } finally {
      release();
      await app.close();
      await db.cleanup();
    }
  });
  it('persists a failed tool action without a success badge', async () => {
    const db = await createTestDatabase();
    const engine: ConsultationEngine = {
      source: 'deterministic',
      promptVersion: 'test',
      async *run() {
        yield {
          type: 'tool-error',
          toolCallId: 'failed',
          tool: 'search-knowledge',
          code: 'tool_failed',
        };
        yield { type: 'text-delta', text: 'Não foi possível consultar a base.' };
        yield {
          type: 'decision',
          decision: {
            intent: 'Consulta',
            action: 'clarify',
            appliedRule: 'Falha',
            confidence: 0.1,
            justification: 'Ferramenta indisponível',
            missingFacts: [],
            quickReplies: [],
          },
        };
        yield { type: 'finish' };
      },
    };
    const app = await createApp(
      { host: '127.0.0.1', port: 3001, webOrigin: 'http://localhost:3000', databaseUrl: db.url },
      { consultationEngine: engine },
    );
    try {
      const server = app.getHttpServer();
      const auth = await request(server)
        .post('/api/session')
        .send({ email: 'ana.souza@nexo.com.br', password: 'x' })
        .expect(201);
      const cookie = String(auth.headers['set-cookie']?.[0]);
      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', cookie)
        .send({})
        .expect(201);
      const path = `/api/conversations/${conversation.body.id}/messages`;
      const response = await request(server)
        .post(`${path}/stream`)
        .set('Cookie', cookie)
        .send({ content: 'VPN' })
        .expect(201);
      const parts = events(response.text);
      expect(parts.find((part) => part.type === 'action').action.status).toBe('failed');
      expect(parts.at(-1).message.decision.actions).toEqual([
        expect.objectContaining({ status: 'failed' }),
      ]);
      expect(parts.at(-1).message.decision.evidence).toEqual([]);
    } finally {
      await app.close();
      await db.cleanup();
    }
  });
  it('persists an interruption when the client disconnects during generation', async () => {
    const db = await createTestDatabase();
    const client = createDatabaseClient(db.url);
    const engine: ConsultationEngine = {
      source: 'deterministic',
      promptVersion: 'test',
      async *run(input) {
        yield { type: 'text-delta', text: 'Parcial' };
        await new Promise<void>((resolve) =>
          input.signal.addEventListener('abort', () => resolve(), { once: true }),
        );
        throw new Error('interrupted');
      },
    };
    const app = await createApp(
      { host: '127.0.0.1', port: 3001, webOrigin: 'http://localhost:3000', databaseUrl: db.url },
      { consultationEngine: engine },
    );
    try {
      await app.listen(0, '127.0.0.1');
      const server = app.getHttpServer();
      const auth = await request(server)
        .post('/api/session')
        .send({ email: 'ana.souza@nexo.com.br', password: 'x' })
        .expect(201);
      const cookie = String(auth.headers['set-cookie']?.[0]).split(';')[0]!;
      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', cookie)
        .send({})
        .expect(201);
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing server address');
      const controller = new AbortController();
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/conversations/${conversation.body.id}/messages/stream`,
        {
          method: 'POST',
          headers: { cookie, 'content-type': 'application/json' },
          body: JSON.stringify({ content: 'VPN' }),
          signal: controller.signal,
        },
      );
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (!text.includes('Parcial')) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error('Stream ended before partial text');
        text += decoder.decode(chunk.value);
      }
      controller.abort();
      let agent = null;
      for (let attempt = 0; attempt < 50 && !agent; attempt++) {
        agent = await client.message.findFirst({
          where: { conversationId: conversation.body.id, role: 'agent' },
          include: { decision: true },
        });
        if (!agent) await new Promise((resolve) => setTimeout(resolve, 40));
      }
      expect(agent).toMatchObject({
        status: 'failed',
        decision: { errorCode: 'interrupted', outcome: 'failed' },
      });
    } finally {
      await app.close();
      await client.$disconnect();
      await db.cleanup();
    }
  });
  it('maps a provider HTTP 429 error to quota without exposing its message', async () => {
    const db = await createTestDatabase();
    const engine: ConsultationEngine = {
      source: 'live',
      promptVersion: 'test',
      async *run() {
        yield* [];
        throw Object.assign(new Error('private provider details'), { statusCode: 429 });
      },
    };
    const app = await createApp(
      { host: '127.0.0.1', port: 3001, webOrigin: 'http://localhost:3000', databaseUrl: db.url },
      { consultationEngine: engine },
    );
    try {
      const server = app.getHttpServer();
      const auth = await request(server)
        .post('/api/session')
        .send({ email: 'ana.souza@nexo.com.br', password: 'x' })
        .expect(201);
      const cookie = String(auth.headers['set-cookie']?.[0]);
      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', cookie)
        .send({})
        .expect(201);
      const response = await request(server)
        .post(`/api/conversations/${conversation.body.id}/messages/stream`)
        .set('Cookie', cookie)
        .send({ content: 'VPN' })
        .expect(201);
      expect(events(response.text).at(-2)).toEqual({ type: 'error', code: 'quota' });
      expect(response.text).not.toContain('private provider details');
    } finally {
      await app.close();
      await db.cleanup();
    }
  });
  it.each(['quota', 'model_unavailable', 'invalid_output', 'interrupted'])(
    'persists an honest failed answer for %s',
    async (code) => {
      const db = await createTestDatabase();
      const engine: ConsultationEngine = {
        source: 'deterministic',
        promptVersion: 'test',
        async *run() {
          yield* [];
          throw new Error(code);
        },
      };
      const env = {
        host: '127.0.0.1',
        port: 3001,
        webOrigin: 'http://localhost:3000',
        databaseUrl: db.url,
      };
      const app = await createApp(env, { consultationEngine: engine });
      try {
        const server = app.getHttpServer();
        const auth = await request(server)
          .post('/api/session')
          .send({ email: 'ana.souza@nexo.com.br', password: 'x' })
          .expect(201);
        const cookie = String(auth.headers['set-cookie']?.[0]);
        const conversation = await request(server)
          .post('/api/conversations')
          .set('Cookie', cookie)
          .send({})
          .expect(201);
        const path = `/api/conversations/${conversation.body.id}/messages`;
        const response = await request(server)
          .post(`${path}/stream`)
          .set('Cookie', cookie)
          .send({ content: 'VPN' })
          .expect(201);
        const parts = events(response.text);
        expect(parts.at(-2)).toEqual({ type: 'error', code });
        expect(parts.at(-1).message).toMatchObject({
          status: 'failed',
          decision: {
            outcome: 'failed',
            action: 'unavailable',
            confidence: 0,
            errorCode: code,
            actions: [],
            evidence: [],
          },
        });
        const history = await request(server).get(path).set('Cookie', cookie).expect(200);
        expect(history.body).toHaveLength(2);
        expect(history.body[1].status).toBe('failed');
      } finally {
        await app.close();
        await db.cleanup();
      }
    },
  );

  it('rejects a late agent answer after claim and return', async () => {
    const db = await createTestDatabase();
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const engine: ConsultationEngine = {
      source: 'deterministic',
      promptVersion: 'test',
      async *run() {
        yield { type: 'text-delta', text: 'Parcial' };
        await gate;
        yield {
          type: 'decision',
          decision: {
            intent: 'Teste',
            action: 'answer',
            appliedRule: 'IT',
            confidence: 1,
            justification: 'Teste',
            missingFacts: [],
            quickReplies: [],
          },
        };
        yield { type: 'finish' };
      },
    };
    const app = await createApp(
      { host: '127.0.0.1', port: 3001, webOrigin: 'http://localhost:3000', databaseUrl: db.url },
      { consultationEngine: engine },
    );
    try {
      await app.listen(0, '127.0.0.1');
      const server = app.getHttpServer();
      const login = async (email: string) =>
        String(
          (await request(server).post('/api/session').send({ email, password: 'x' }).expect(201))
            .headers['set-cookie']?.[0],
        ).split(';')[0]!;
      const ana = await login('ana.souza@nexo.com.br');
      const analyst = await login('analista@nexo.com.br');
      const conversation = await request(server)
        .post('/api/conversations')
        .set('Cookie', ana)
        .send({})
        .expect(201);
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing server address');
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/conversations/${conversation.body.id}/messages/stream`,
        {
          method: 'POST',
          headers: { cookie: ana, 'content-type': 'application/json' },
          body: JSON.stringify({ content: 'Preciso de ajuda' }),
        },
      );
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (!text.includes('Parcial')) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error('Stream ended before partial text');
        text += decoder.decode(chunk.value);
      }
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
        .post(`/api/support/conversations/${conversation.body.id}/return`)
        .set('Cookie', analyst)
        .send({})
        .expect(201);
      release();
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        text += decoder.decode(chunk.value);
      }
      expect(text).toContain('"type":"handoff-waiting"');
      const history = await request(server)
        .get(`/api/conversations/${conversation.body.id}/messages`)
        .set('Cookie', ana)
        .expect(200);
      expect(history.body).toHaveLength(1);
      expect(history.body[0]).toMatchObject({ role: 'employee', content: 'Preciso de ajuda' });
    } finally {
      release();
      await app.close();
      await db.cleanup();
    }
  });
});
