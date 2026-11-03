import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createDatabaseClient } from '../src/database/client.js';
import { FailureSimulator, TransientTicketError } from '../src/tickets/failure-simulator.js';
import { createTestDatabase } from './support/test-database.js';

const input = { action: 'create', title: 'Falha controlada', description: 'Teste de recuperação', type: 'INC', category: 'hardware', impact: 'self', workState: 'stopped', urgency: 'normal' };

describe('B15: temporary ticket service failures', () => {
  it('retries reads and confirmed writes without fabricating success or duplicating events', async () => {
    const db = await createTestDatabase();
    const env = { host: '127.0.0.1', port: 3001, webOrigin: 'http://localhost:3000', databaseUrl: db.url };
    let app = await createApp(env);
    const client = createDatabaseClient(db.url);
    try {
      let server = app.getHttpServer();
      const login = await request(server).post('/api/session').send({ email: 'ana.souza@nexo.com.br', password: 'x' }).expect(201);
      const cookie = String(login.headers['set-cookie']?.[0]);
      let simulator = app.get(FailureSimulator);
      let before = vi.spyOn(simulator, 'beforeOperation');
      before.mockImplementationOnce(() => { throw new TransientTicketError(); }).mockImplementationOnce(() => { throw new TransientTicketError(); });
      expect((await request(server).get('/api/tickets').set('Cookie', cookie).expect(200)).body).toHaveLength(2);
      expect(before).toHaveBeenCalledTimes(3);
      before.mockReset().mockImplementation(() => { throw new TransientTicketError(); });
      await request(server).get('/api/tickets').set('Cookie', cookie).expect(503);
      expect(before).toHaveBeenCalledTimes(3);
      before.mockRestore();
      const draft = (await request(server).post('/api/ticket-drafts').set('Cookie', cookie).send(input).expect(201)).body;
      const confirmation = { version: draft.version, operationId: draft.operationId };
      before = vi.spyOn(simulator, 'beforeOperation');
      before.mockImplementationOnce(() => { throw new TransientTicketError(); }).mockImplementationOnce(() => { throw new TransientTicketError(); });
      const result = (await request(server).post(`/api/ticket-drafts/${draft.id}/confirm`).set('Cookie', cookie).send(confirmation).expect(201)).body;
      expect(before).toHaveBeenCalledTimes(3);
      expect(await client.ticketEvent.count({ where: { ticketId: result.id } })).toBe(1);
      before.mockRestore();
      const exhausted = (await request(server).post('/api/ticket-drafts').set('Cookie', cookie).send({ ...input, title: 'Falha esgotada' }).expect(201)).body;
      before = vi.spyOn(simulator, 'beforeOperation').mockImplementation(() => { throw new TransientTicketError(); });
      await request(server).post(`/api/ticket-drafts/${exhausted.id}/confirm`).set('Cookie', cookie).send({ version: 1, operationId: exhausted.operationId }).expect(503);
      expect(before).toHaveBeenCalledTimes(3);
      expect(await client.ticket.count({ where: { normalizedTitle: 'falha esgotada' } })).toBe(0);
      before.mockRestore();
      const afterDraft = (await request(server).post('/api/ticket-drafts').set('Cookie', cookie).send({ ...input, title: 'Resposta perdida', description: 'Projetor não exibe imagem' }).expect(201)).body;
      const after = vi.spyOn(simulator, 'afterCommit').mockImplementationOnce(() => { throw new TransientTicketError(); });
      const afterResult = (await request(server).post(`/api/ticket-drafts/${afterDraft.id}/confirm`).set('Cookie', cookie).send({ version: 1, operationId: afterDraft.operationId }).expect(201)).body;
      expect(after).toHaveBeenCalledTimes(1);
      expect(await client.ticketEvent.count({ where: { ticketId: afterResult.id } })).toBe(1);
      after.mockRestore();
      await app.close(); app = await createApp(env); server = app.getHttpServer(); simulator = app.get(FailureSimulator);
      const recovered = (await request(server).post(`/api/ticket-drafts/${afterDraft.id}/confirm`).set('Cookie', cookie).send({ version: 1, operationId: afterDraft.operationId }).expect(201)).body;
      expect(recovered.id).toBe(afterResult.id);
      expect(await client.ticketEvent.count({ where: { ticketId: recovered.id } })).toBe(1);
      before = vi.spyOn(simulator, 'beforeOperation');
      await request(server).post(`/api/ticket-drafts/${afterDraft.id}/confirm`).set('Cookie', cookie).send({ version: 0, operationId: afterDraft.operationId }).expect(400);
      expect(before).not.toHaveBeenCalled();
    } finally { await client.$disconnect(); await app.close(); await db.cleanup(); }
  });
});
