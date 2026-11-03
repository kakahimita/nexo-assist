import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserViewSchema } from '@nexo/contracts';
import { createApp } from '../src/app.js';
import { createTestDatabase } from './support/test-database.js';
import { createDatabaseClient } from '../src/database/client.js';
import { ConsultationTools } from '../src/agent/tools/consultation-tools.js';
import { ConversationsService } from '../src/conversations/conversations.service.js';
import { DraftsService } from '../src/tickets/drafts.service.js';

const input = { action: 'create', title: 'Falha no projetor', description: 'O projetor não liga' };
describe('B04/B05/B13/B16: authorized draft proposal tool', () => {
  it('binds proposals to owner, conversation and run without writing a ticket', async () => {
    const db = await createTestDatabase();
    const client = createDatabaseClient(db.url);
    const app = await createApp({
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
      databaseUrl: db.url,
    });
    try {
      const ana = UserViewSchema.parse(
        await client.user.findUniqueOrThrow({ where: { email: 'ana.souza@nexo.com.br' } }),
      );
      const bruno = UserViewSchema.parse(
        await client.user.findUniqueOrThrow({ where: { email: 'bruno.lima@nexo.com.br' } }),
      );
      const analyst = UserViewSchema.parse(
        await client.user.findUniqueOrThrow({ where: { email: 'analista@nexo.com.br' } }),
      );
      const conversation = await app.get(ConversationsService).create(ana);
      const tools = app.get(ConsultationTools);
      const context = { conversationId: conversation.id, runId: randomUUID(), now: new Date() };
      const count = await client.ticket.count();
      await expect(tools.proposeDraft(analyst, input, context)).rejects.toMatchObject({
        status: 403,
      });
      await expect(tools.proposeDraft(bruno, input, context)).rejects.toMatchObject({
        status: 404,
      });
      await expect(
        tools.proposeDraft(ana, { ...input, impact: 'unknown' }, context),
      ).rejects.toThrow();
      await expect(
        tools.proposeDraft(ana, { ...input, ownerId: bruno.id }, context),
      ).rejects.toThrow();
      await expect(tools.proposeDraft(ana, input, context)).rejects.toThrow();
      const conversations = app.get(ConversationsService);
      await conversations.append(ana, conversation.id, 'Abrir chamado: Falha no projetor');
      await conversations.append(ana, conversation.id, 'O projetor não liga');
      await conversations.append(ana, conversation.id, 'Somente eu');
      await conversations.append(ana, conversation.id, 'Consigo trabalhar com alternativa');
      await conversations.append(ana, conversation.id, 'Sem compromisso em risco hoje');
      await expect(
        tools.proposeDraft(
          ana,
          { ...input, title: 'Problema não informado' },
          { ...context, runId: randomUUID() },
        ),
      ).rejects.toThrow();
      await expect(
        tools.proposeDraft(
          ana,
          { ...input, description: 'Descrição inventada' },
          { ...context, runId: randomUUID() },
        ),
      ).rejects.toThrow();
      await expect(
        tools.proposeDraft(ana, { ...input, type: 'REQ' }, { ...context, runId: randomUUID() }),
      ).rejects.toThrow();
      await expect(
        tools.proposeDraft(
          ana,
          { ...input, category: 'email' },
          { ...context, runId: randomUUID() },
        ),
      ).rejects.toThrow();
      const first = await tools.proposeDraft(ana, input, context);
      expect(first).toMatchObject({ status: 'draft', draftId: expect.any(String) });
      if (first.status !== 'draft') throw new Error('Expected draft');
      expect((await app.get(DraftsService).get(ana, first.draftId)).input).toMatchObject({
        type: 'INC',
        category: 'hardware',
        impact: 'self',
        workState: 'workaround',
        urgency: 'normal',
      });
      const login = async (email: string) =>
        String(
          (
            await request(app.getHttpServer())
              .post('/api/session')
              .send({ email, password: 'x' })
              .expect(201)
          ).headers['set-cookie']?.[0],
        );
      const anaCookie = await login(ana.email);
      const brunoCookie = await login(bruno.email);
      expect(
        (
          await request(app.getHttpServer())
            .get(`/api/conversations/${conversation.id}/draft-proposals`)
            .set('Cookie', anaCookie)
            .expect(200)
        ).body,
      ).toEqual([{ draftId: first.draftId }]);
      await request(app.getHttpServer())
        .get(`/api/conversations/${conversation.id}/draft-proposals`)
        .set('Cookie', brunoCookie)
        .expect(404);
      expect(await tools.proposeDraft(ana, input, context)).toEqual(first);
      expect(await client.ticket.count()).toBe(count);
      expect(
        await client.draftProposalRun.count({
          where: { id: context.runId, ownerId: ana.id, conversationId: conversation.id },
        }),
      ).toBe(1);
      await conversations.append(ana, conversation.id, 'Abrir chamado: Outro problema');
      await expect(
        tools.proposeDraft(
          ana,
          { ...input, title: 'Outro problema' },
          { ...context, runId: randomUUID() },
        ),
      ).rejects.toThrow();
      await conversations.append(ana, conversation.id, 'Somente eu');
      await conversations.append(ana, conversation.id, 'Consigo trabalhar com alternativa');
      await conversations.append(ana, conversation.id, 'Sem compromisso em risco hoje');
      await conversations.append(ana, conversation.id, 'Abrir chamado: Notebook lento');
      await conversations.append(ana, conversation.id, 'Somente eu');
      await conversations.append(ana, conversation.id, 'Consigo trabalhar com alternativa');
      await conversations.append(ana, conversation.id, 'Sem compromisso em risco hoje');
      const duplicate = await tools.proposeDraft(
        ana,
        { ...input, title: 'Notebook lento', description: 'Notebook lento' },
        { ...context, runId: randomUUID() },
      );
      expect(duplicate).toMatchObject({ status: 'duplicate_candidates' });
      const foreign = await tools.proposeDraft(
        ana,
        { action: 'supplement', ticketId: 'fixture-bruno-open', content: 'x' },
        { ...context, runId: randomUUID() },
      );
      expect(foreign).toEqual({ status: 'ticket_not_found' });
      await expect(
        tools.proposeDraft(
          ana,
          { action: 'supplement', ticketId: 'fixture-ana-open', content: 'Detalhes inventados' },
          { ...context, runId: randomUUID() },
        ),
      ).rejects.toThrow();
      await conversations.append(ana, conversation.id, 'Abrir chamado: Sistema da equipe parou');
      await conversations.append(ana, conversation.id, 'Minha equipe');
      await conversations.append(ana, conversation.id, 'Trabalho parado');
      await conversations.append(ana, conversation.id, 'Sem compromisso em risco hoje');
      const critical = await tools.proposeDraft(
        ana,
        { ...input, title: 'Sistema da equipe parou', description: 'Sistema da equipe parou' },
        { ...context, runId: randomUUID() },
      );
      expect(critical).toEqual({ status: 'critical_requires_handoff' });
      expect(await client.ticket.count()).toBe(count);
    } finally {
      await app.close();
      await client.$disconnect();
      await db.cleanup();
    }
  });
});
