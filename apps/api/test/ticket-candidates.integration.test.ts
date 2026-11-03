import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestDatabase } from './support/test-database.js';
import { createDatabaseClient } from '../src/database/client.js';

const input = { action: 'create', title: 'Computador portátil devagar', description: 'Lentidão após atualização', type: 'INC', category: 'hardware', impact: 'self', workState: 'workaround', urgency: 'normal' };

describe('B05: review possible duplicates before confirmation', () => {
  it('requires an explicit decision on possible matches while never allowing exact duplicates', async () => {
    const db = await createTestDatabase(); const client = createDatabaseClient(db.url); const app = await createApp({ host: '127.0.0.1', port: 3001, webOrigin: 'http://localhost:3000', databaseUrl: db.url });
    try {
      const server = app.getHttpServer();
      const auth = await request(server).post('/api/session').send({ email: 'ana.souza@nexo.com.br', password: 'x' }).expect(201);
      const cookie = String(auth.headers['set-cookie']?.[0]);
      const created = await request(server).post('/api/ticket-drafts').set('Cookie', cookie).send(input).expect(201);
      expect(created.body.candidates.map((ticket: { id: string }) => ticket.id)).toContain('fixture-ana-open');
      const confirm = { version: created.body.version, operationId: created.body.operationId };
      const refused = await request(server).post(`/api/ticket-drafts/${created.body.id}/confirm`).set('Cookie', cookie).send(confirm).expect(409);
      expect(refused.body.code).toBe('duplicate_candidates');
      const owner = await client.user.findUniqueOrThrow({ where: { email: 'ana.souza@nexo.com.br' } });
      await client.ticket.create({ data: { id: 'later', ownerId: owner.id, title: 'Notebook lento depois', normalizedTitle: 'notebook lento depois', description: 'Notebook lento após atualização', type: 'INC', category: 'hardware', priority: 'medium', impact: 'self', slaStartedAt: new Date() } });
      const changed = await request(server).post(`/api/ticket-drafts/${created.body.id}/confirm`).set('Cookie', cookie).send({ ...confirm, dismissedCandidateIds: ['fixture-ana-open'] }).expect(409);
      expect(changed.body.candidates.map((ticket: { id: string }) => ticket.id)).toContain('later');
      await client.ticket.delete({ where: { id: 'later' } });
      await request(server).post(`/api/ticket-drafts/${created.body.id}/confirm`).set('Cookie', cookie).send({ ...confirm, dismissedCandidateIds: ['fixture-ana-open'] }).expect(201);
      const exact = await request(server).post('/api/ticket-drafts').set('Cookie', cookie).send({ ...input, title: 'Notebook lento' }).expect(201);
      await request(server).post(`/api/ticket-drafts/${exact.body.id}/confirm`).set('Cookie', cookie).send({ version: exact.body.version, operationId: exact.body.operationId, dismissedCandidateIds: ['fixture-ana-open'] }).expect(409);
    } finally { await app.close(); await client.$disconnect(); await db.cleanup(); }
  });
});
