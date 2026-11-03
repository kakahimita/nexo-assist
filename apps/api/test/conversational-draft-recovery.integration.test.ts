import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestDatabase } from './support/test-database.js';
import { ConsultationTools } from '../src/agent/tools/consultation-tools.js';
import type { ConsultationEngine } from '../src/agent/consultation/types.js';

describe('B13: recover an interrupted draft proposal', () => {
  it('restores the pending draft after interruption and restart without creating a ticket', async () => {
    const db = await createTestDatabase();
    const env = { host: '127.0.0.1', port: 3001, webOrigin: 'http://localhost:3000', databaseUrl: db.url };
    const holder: { tools?: ConsultationTools } = {};
    const engine: ConsultationEngine = { source: 'deterministic', promptVersion: 'test', async *run(input) {
      if (!input.runId || !input.conversationId) throw new Error('Missing server context');
      if (!holder.tools) throw new Error('Missing consultation tools');
      const result = await holder.tools.proposeDraft(input.user, { action: 'create', title: 'Impressora travou', description: 'A impressora travou' }, { runId: input.runId, conversationId: input.conversationId, now: input.now });
      yield { type: 'tool-result', toolCallId: 'proposal', tool: 'propose-ticket-draft', result };
      throw new Error('interrupted');
    } };
    let app = await createApp(env, { consultationEngine: engine }); holder.tools = app.get(ConsultationTools);
    try {
      let server = app.getHttpServer();
      const login = await request(server).post('/api/session').send({ email: 'ana.souza@nexo.com.br', password: 'x' }).expect(201);
      const cookie = String(login.headers['set-cookie']?.[0]);
      const created = await request(server).post('/api/conversations').set('Cookie', cookie).send({}).expect(201);
      const path = `/api/conversations/${created.body.id}`;
      for (const content of ['Abrir chamado: A impressora travou', 'Somente eu', 'Consigo trabalhar com alternativa', 'Sem compromisso em risco hoje']) await request(server).post(`${path}/messages`).set('Cookie', cookie).send({ content }).expect(201);
      const before = (await request(server).get('/api/tickets').set('Cookie', cookie).expect(200)).body;
      const stream = await request(server).post(`${path}/messages/stream`).set('Cookie', cookie).send({ content: 'Continuar' }).expect(201);
      const events = stream.text.split('\n\n').filter(Boolean).map((chunk) => JSON.parse(chunk.slice(6)));
      expect(events.at(-1)).toMatchObject({ type: 'done', message: { status: 'failed', decision: { draftId: null } } });
      const pending = (await request(server).get(`${path}/draft-proposals`).set('Cookie', cookie).expect(200)).body;
      expect(pending).toHaveLength(1);
      await app.close(); app = await createApp(env); server = app.getHttpServer();
      expect((await request(server).get(`${path}/draft-proposals`).set('Cookie', cookie).expect(200)).body).toEqual(pending);
      expect((await request(server).get('/api/tickets').set('Cookie', cookie).expect(200)).body).toEqual(before);
    } finally { await app.close(); await db.cleanup(); }
  });
});
