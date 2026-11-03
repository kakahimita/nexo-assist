import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createDatabaseClient } from '../src/database/client.js';
import { createTestDatabase } from './support/test-database.js';

const draft = { action: 'create', title: '  NOTEBOOK   LENTO ', description: 'Meu notebook está lento', type: 'INC', category: 'hardware', impact: 'self', workState: 'workaround', urgency: 'normal' };

describe('B03 B04 B13 B16: authorized tickets and drafts', () => {
  it('isolates users, validates drafts and restores ticket history', async () => {
    const db = await createTestDatabase();
    const env = { host: '127.0.0.1', port: 3001, webOrigin: 'http://localhost:3000', databaseUrl: db.url };
    let app = await createApp(env);
    const client = createDatabaseClient(db.url);
    try {
      let server = app.getHttpServer();
      const login = async (email: string) => String((await request(server).post('/api/session').send({ email, password: 'x' }).expect(201)).headers['set-cookie']?.[0]);
      const ana = await login('ana.souza@nexo.com.br');
      const bruno = await login('bruno.lima@nexo.com.br');
      const analyst = await login('analista@nexo.com.br');
      await request(server).get('/api/tickets').expect(401);
      await request(server).get('/api/tickets').set('Cookie', analyst).expect(403);
      const tickets = (await request(server).get('/api/tickets').set('Cookie', ana).expect(200)).body;
      expect(tickets).toHaveLength(2);
      expect(tickets.every((ticket: { id: string }) => ticket.id.startsWith('fixture-ana-'))).toBe(true);
      expect(tickets.find((ticket: { id: string }) => ticket.id === 'fixture-ana-open').overdue).toBe(true);
      await request(server).get('/api/tickets/fixture-ana-open').set('Cookie', bruno).expect(404);
      await request(server).get('/api/tickets/fixture-ana-open/history').set('Cookie', bruno).expect(404);
      await request(server).post('/api/ticket-drafts').set('Cookie', ana).send({ ...draft, ownerId: 'forged' }).expect(400);
      await request(server).post('/api/ticket-drafts').set('Cookie', ana).send({ ...draft, impact: 'unknown' }).expect(400);
      expect(await client.ticketDraft.count()).toBe(0);
      await client.ticket.update({ where: { id: 'fixture-bruno-open' }, data: { title: 'Notebook lento', normalizedTitle: 'notebook lento' } });
      const created = (await request(server).post('/api/ticket-drafts').set('Cookie', ana).send(draft).expect(201)).body;
      expect(created.priority).toBe('medium');
      expect(created.candidates.map((ticket: { id: string }) => ticket.id)).toEqual(['fixture-ana-open']);
      await request(server).get(`/api/ticket-drafts/${created.id}`).set('Cookie', bruno).expect(404);
      const updated = (await request(server).post(`/api/ticket-drafts/${created.id}/edit`).set('Cookie', ana).send({ version: 1, input: { ...draft, title: 'Outro problema', description: 'A impressora não responde' } }).expect(201)).body;
      expect(updated.version).toBe(2);
      expect(updated.operationId).not.toBe(created.operationId);
      expect(updated.candidates).toEqual([]);
      await request(server).post(`/api/ticket-drafts/${created.id}/edit`).set('Cookie', ana).send({ version: 1, input: draft }).expect(409);
      await request(server).post(`/api/ticket-drafts/${created.id}/cancel`).set('Cookie', ana).send({ version: 2 }).expect(201);
      expect(await client.ticket.count()).toBe(3);
      expect(await client.ticketEvent.count()).toBe(3);
      const original = (await request(server).get('/api/tickets/fixture-ana-open/history').set('Cookie', ana).expect(200)).body;
      await app.close();
      app = await createApp(env);
      server = app.getHttpServer();
      expect((await request(server).get('/api/tickets/fixture-ana-open/history').set('Cookie', ana).expect(200)).body).toEqual(original);
      expect((await request(server).get(`/api/ticket-drafts/${created.id}`).set('Cookie', ana).expect(200)).body.status).toBe('cancelled');
      await client.ticket.delete({ where: { id: 'fixture-bruno-open' } });
      expect((await request(server).get('/api/tickets').set('Cookie', bruno).expect(200)).body).toEqual([]);
    } finally { await client.$disconnect(); await app.close(); await db.cleanup(); }
  });
});
