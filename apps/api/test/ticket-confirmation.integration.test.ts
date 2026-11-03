import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { UserViewSchema } from '@nexo/contracts';
import { createApp } from '../src/app.js';
import { createDatabaseClient } from '../src/database/client.js';
import { DraftsService } from '../src/tickets/drafts.service.js';
import { createTestDatabase } from './support/test-database.js';

const newTicket = {
  action: 'create',
  title: 'Erro na impressora',
  description: 'A impressão falha',
  type: 'INC',
  category: 'hardware',
  impact: 'self',
  workState: 'stopped',
  urgency: 'normal',
};

describe('B04–B06: atomic confirmation', () => {
  it('replays one write, rejects stale keys and prevents concurrent duplicates', async () => {
    const db = await createTestDatabase();
    const env = {
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
      databaseUrl: db.url,
    };
    let app = await createApp(env);
    const client = createDatabaseClient(db.url);
    try {
      let server = app.getHttpServer();
      const login = async (email: string) =>
        String(
          (await request(server).post('/api/session').send({ email, password: 'x' }).expect(201))
            .headers['set-cookie']?.[0],
        );
      const ana = await login('ana.souza@nexo.com.br');
      const bruno = await login('bruno.lima@nexo.com.br');
      const draft = (
        await request(server)
          .post('/api/ticket-drafts')
          .set('Cookie', ana)
          .send(newTicket)
          .expect(201)
      ).body;
      const confirm = { version: draft.version, operationId: draft.operationId };
      const send = () =>
        request(server)
          .post(`/api/ticket-drafts/${draft.id}/confirm`)
          .set('Cookie', ana)
          .send(confirm);
      const [first, second] = await Promise.all([send(), send()]);
      expect([first.status, second.status]).toEqual([201, 201]);
      expect(first.body.id).toBe(second.body.id);
      expect(await client.ticket.count({ where: { normalizedTitle: 'erro na impressora' } })).toBe(
        1,
      );
      expect(await client.ticketEvent.count({ where: { ticketId: first.body.id } })).toBe(1);
      await request(server)
        .post(`/api/ticket-drafts/${draft.id}/confirm`)
        .set('Cookie', ana)
        .send({ ...confirm, operationId: randomUUID() })
        .expect(409);
      await request(server)
        .post(`/api/ticket-drafts/${draft.id}/confirm`)
        .set('Cookie', ana)
        .send({ ...confirm, version: 2 })
        .expect(409);
      await request(server)
        .post(`/api/ticket-drafts/${draft.id}/confirm`)
        .set('Cookie', bruno)
        .send(confirm)
        .expect(404);
      const cancelled = (
        await request(server)
          .post('/api/ticket-drafts')
          .set('Cookie', ana)
          .send({ ...newTicket, title: 'Cancelar' })
          .expect(201)
      ).body;
      await request(server)
        .post(`/api/ticket-drafts/${cancelled.id}/cancel`)
        .set('Cookie', ana)
        .send({ version: 1 })
        .expect(201);
      await request(server)
        .post(`/api/ticket-drafts/${cancelled.id}/confirm`)
        .set('Cookie', ana)
        .send({ version: 1, operationId: cancelled.operationId })
        .expect(409);
      await request(server)
        .post(`/api/ticket-drafts/${cancelled.id}/confirm`)
        .set('Cookie', ana)
        .send(confirm)
        .expect(409);
      const left = (
        await request(server)
          .post('/api/ticket-drafts')
          .set('Cookie', ana)
          .send({ ...newTicket, title: 'Tela apagada', description: 'A tela não acende' })
          .expect(201)
      ).body;
      const right = (
        await request(server)
          .post('/api/ticket-drafts')
          .set('Cookie', ana)
          .send({ ...newTicket, title: 'Tela apagada', description: 'A tela não acende' })
          .expect(201)
      ).body;
      const outcomes = await Promise.all(
        [left, right].map((item) =>
          request(server)
            .post(`/api/ticket-drafts/${item.id}/confirm`)
            .set('Cookie', ana)
            .send({ version: item.version, operationId: item.operationId }),
        ),
      );
      expect(outcomes.map((result) => result.status).sort()).toEqual([201, 409]);
      expect(await client.ticket.count({ where: { normalizedTitle: 'tela apagada' } })).toBe(1);
      const contested = (
        await request(server)
          .post('/api/ticket-drafts')
          .set('Cookie', ana)
          .send({ ...newTicket, title: 'Cabo solto', description: 'O cabo está desconectado' })
          .expect(201)
      ).body;
      const races = await Promise.all(
        [contested.operationId, randomUUID()].map((operationId) =>
          request(server)
            .post(`/api/ticket-drafts/${contested.id}/confirm`)
            .set('Cookie', ana)
            .send({ version: 1, operationId }),
        ),
      );
      expect(races.map((result) => result.status).sort()).toEqual([201, 409]);
      expect(await client.ticket.count({ where: { normalizedTitle: 'cabo solto' } })).toBe(1);
      const stale = (
        await request(server)
          .post('/api/ticket-drafts')
          .set('Cookie', ana)
          .send({ ...newTicket, title: 'Projetor' })
          .expect(201)
      ).body;
      await request(server)
        .post(`/api/ticket-drafts/${stale.id}/edit`)
        .set('Cookie', ana)
        .send({ version: 1, input: { ...newTicket, title: 'Projetor dois' } })
        .expect(201);
      await request(server)
        .post(`/api/ticket-drafts/${stale.id}/confirm`)
        .set('Cookie', ana)
        .send({ version: 1, operationId: stale.operationId })
        .expect(409);
      await app.close();
      app = await createApp(env);
      server = app.getHttpServer();
      expect(
        (
          await request(server)
            .post(`/api/ticket-drafts/${draft.id}/confirm`)
            .set('Cookie', ana)
            .send(confirm)
            .expect(201)
        ).body.id,
      ).toBe(first.body.id);
    } finally {
      await client.$disconnect();
      await app.close();
      await db.cleanup();
    }
  });

  it('preserves the SLA on supplements and enforces the exact reopening boundary', async () => {
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
      const login = await request(server)
        .post('/api/session')
        .send({ email: 'ana.souza@nexo.com.br', password: 'x' })
        .expect(201);
      const cookie = String(login.headers['set-cookie']?.[0]);
      const user = UserViewSchema.parse(login.body);
      const service = app.get(DraftsService);
      const clock = new Date('2026-11-02T12:00:00.000Z');
      const before = await client.ticket.findUniqueOrThrow({ where: { id: 'fixture-ana-open' } });
      const supplement = (
        await request(server)
          .post('/api/ticket-drafts')
          .set('Cookie', cookie)
          .send({ action: 'supplement', ticketId: before.id, content: 'Mais detalhes' })
          .expect(201)
      ).body;
      await service.confirm(
        user,
        supplement.id,
        { version: 1, operationId: supplement.operationId },
        clock,
      );
      expect(
        (await client.ticket.findUniqueOrThrow({ where: { id: before.id } })).slaStartedAt,
      ).toEqual(before.slaStartedAt);
      expect(
        await client.ticketEvent.count({ where: { ticketId: before.id, kind: 'supplemented' } }),
      ).toBe(1);
      const transfer = (
        await request(server)
          .post('/api/ticket-drafts')
          .set('Cookie', cookie)
          .send({ action: 'transfer', ticketId: before.id, reason: 'Preciso de ajuda' })
          .expect(201)
      ).body;
      const transferred = await service.confirm(
        user,
        transfer.id,
        { version: 1, operationId: transfer.operationId },
        clock,
      );
      expect(transferred.transferRequested).toBe(true);
      expect(
        await client.ticketEvent.count({
          where: { ticketId: before.id, kind: 'transfer_requested' },
        }),
      ).toBe(1);
      await client.ticket.update({
        where: { id: 'fixture-ana-resolved' },
        data: { resolvedAt: new Date('2026-10-26T12:00:00Z') },
      });
      const reopen = (
        await request(server)
          .post('/api/ticket-drafts')
          .set('Cookie', cookie)
          .send({ action: 'reopen', ticketId: 'fixture-ana-resolved', reason: 'Voltou' })
          .expect(201)
      ).body;
      const reopened = await service.confirm(
        user,
        reopen.id,
        { version: 1, operationId: reopen.operationId },
        clock,
      );
      expect(reopened.status).toBe('open');
      expect(reopened.slaStartedAt).toBe(clock.toISOString());
      await client.ticket.update({
        where: { id: 'fixture-ana-resolved' },
        data: { status: 'resolved', resolvedAt: new Date('2026-10-26T11:59:59.999Z') },
      });
      const tooLate = (
        await request(server)
          .post('/api/ticket-drafts')
          .set('Cookie', cookie)
          .send({ action: 'reopen', ticketId: 'fixture-ana-resolved', reason: 'Voltou novamente' })
          .expect(201)
      ).body;
      await expect(
        service.confirm(user, tooLate.id, { version: 1, operationId: tooLate.operationId }, clock),
      ).rejects.toMatchObject({ status: 409 });
      await client.ticket.update({
        where: { id: 'fixture-ana-resolved' },
        data: { title: before.title, normalizedTitle: before.normalizedTitle, resolvedAt: clock },
      });
      const duplicate = (
        await request(server)
          .post('/api/ticket-drafts')
          .set('Cookie', cookie)
          .send({ action: 'reopen', ticketId: 'fixture-ana-resolved', reason: 'Mesmo título' })
          .expect(201)
      ).body;
      const priorEvents = await client.ticketEvent.count();
      await expect(
        service.confirm(
          user,
          duplicate.id,
          { version: 1, operationId: duplicate.operationId },
          clock,
        ),
      ).rejects.toMatchObject({ status: 409, response: { code: 'duplicate_candidates' } });
      expect(
        (await client.ticket.findUniqueOrThrow({ where: { id: 'fixture-ana-resolved' } })).status,
      ).toBe('resolved');
      expect(await client.ticketEvent.count()).toBe(priorEvents);
    } finally {
      await client.$disconnect();
      await app.close();
      await db.cleanup();
    }
  });
});
