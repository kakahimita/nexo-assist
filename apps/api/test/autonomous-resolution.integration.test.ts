import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { UserViewSchema } from '@nexo/contracts';
import { createApp } from '../src/app.js';
import { createTestDatabase } from './support/test-database.js';
import { createDatabaseClient } from '../src/database/client.js';
import { ConsultationTools } from '../src/agent/tools/consultation-tools.js';
import { ConversationsService } from '../src/conversations/conversations.service.js';
import { DraftsService } from '../src/tickets/drafts.service.js';
import { HumanSupportService } from '../src/human-support/human-support.service.js';

describe('B02/B04/B09/B10: unresolved support to confirmed ticket and analyst', () => {
  it('accepts natural reports, queues only after confirmation, and never replays the handoff', async () => {
    const db = await createTestDatabase();
    const client = createDatabaseClient(db.url);
    const app = await createApp({
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
      databaseUrl: db.url,
    });
    try {
      const user = UserViewSchema.parse(
        await client.user.findUniqueOrThrow({ where: { email: 'bruno.lima@nexo.com.br' } }),
      );
      const conversations = app.get(ConversationsService);
      const drafts = app.get(DraftsService);
      const tools = app.get(ConsultationTools);
      const conversation = await conversations.create(user);
      for (let index = 0; index < 8; index++)
        await conversations.append(
          user,
          conversation.id,
          'Detalhes de diagnóstico: ' + 'x'.repeat(1000),
        );
      for (const content of [
        'Meu monitor está sem imagem',
        'Já verifiquei os cabos e a entrada, mas não resolveu.',
        'Só eu estou afetado e não consigo trabalhar. Não tenho compromisso em risco hoje.',
      ])
        await conversations.append(user, conversation.id, content);
      const count = await client.ticket.count();
      const result = await tools.proposeDraft(
        user,
        {
          action: 'create',
          title: 'Meu monitor está sem imagem',
          description: 'Meu monitor está sem imagem',
          requiresAnalyst: true,
        },
        { conversationId: conversation.id, runId: randomUUID(), now: new Date() },
      );
      expect(result.status).toBe('draft');
      if (result.status !== 'draft') throw new Error('Expected draft');
      expect(await client.ticket.count()).toBe(count);
      expect(
        (await conversations.list(user)).find((item) => item.id === conversation.id)?.state,
      ).toBe('agent');
      const draft = await drafts.get(user, result.draftId);
      const confirmation = { version: draft.version, operationId: draft.operationId };
      await expect(
        drafts.confirm(user, draft.id, { ...confirmation, version: 999 }, new Date()),
      ).rejects.toThrow();
      expect(
        (await conversations.list(user)).find((item) => item.id === conversation.id)?.state,
      ).toBe('agent');
      const ticket = await drafts.confirm(user, draft.id, confirmation, new Date());
      expect(ticket.status).toBe('waiting_for_analyst');
      const queued = (await conversations.list(user)).find((item) => item.id === conversation.id)!;
      expect(queued.state).toBe('waiting_for_analyst');
      expect(queued.handoff?.summary).toContain('Meu monitor está sem imagem');
      expect(queued.handoff?.summary).toContain('não resolveu');
      expect(queued.handoff?.summary.length).toBeLessThanOrEqual(2000);
      expect(
        (await client.conversation.findUniqueOrThrow({ where: { id: conversation.id } }))
          .contextTicketId,
      ).toBe(ticket.id);
      await drafts.confirm(user, draft.id, confirmation, new Date());
      expect(await client.ticket.count()).toBe(count + 1);
      expect(
        (await conversations.list(user)).find((item) => item.id === conversation.id)?.stateVersion,
      ).toBe(queued.stateVersion);
      const analyst = UserViewSchema.parse(
        await client.user.findUniqueOrThrow({ where: { email: 'analista@nexo.com.br' } }),
      );
      const support = app.get(HumanSupportService);
      await support.claim(analyst, conversation.id);
      expect(await conversations.captureAgentRun(user, conversation.id)).toBeNull();
      await support.reply(
        analyst,
        conversation.id,
        'Já li as tentativas. Vou verificar o monitor.',
      );
      expect((await conversations.messages(user, conversation.id)).at(-1)?.role).toBe('analyst');
      await support.returnToAgent(analyst, conversation.id);
      await drafts.confirm(user, draft.id, confirmation, new Date());
      expect(
        (await conversations.list(user)).find((item) => item.id === conversation.id)?.state,
      ).toBe('agent');
      const cancelledConversation = await conversations.create(user);
      for (const content of [
        'Meu projetor não liga',
        'Somente eu',
        'Consigo trabalhar com alternativa',
        'Sem compromisso em risco hoje',
      ])
        await conversations.append(user, cancelledConversation.id, content);
      const cancelled = await tools.proposeDraft(
        user,
        {
          action: 'create',
          title: 'Meu projetor não liga',
          description: 'Meu projetor não liga',
          requiresAnalyst: true,
        },
        { conversationId: cancelledConversation.id, runId: randomUUID(), now: new Date() },
      );
      if (cancelled.status !== 'draft') throw new Error('Expected draft');
      const pending = await drafts.get(user, cancelled.draftId);
      await drafts.cancel(user, pending.id, pending.version);
      await expect(
        drafts.confirm(
          user,
          pending.id,
          { version: pending.version, operationId: pending.operationId },
          new Date(),
        ),
      ).rejects.toThrow();
      await expect(
        drafts.confirm(
          analyst,
          pending.id,
          { version: pending.version, operationId: pending.operationId },
          new Date(),
        ),
      ).rejects.toThrow();
      expect(
        (await conversations.list(user)).find((item) => item.id === cancelledConversation.id)
          ?.state,
      ).toBe('agent');
      expect(await client.ticket.count()).toBe(count + 1);
    } finally {
      await app.close();
      await client.$disconnect();
      await db.cleanup();
    }
  });
});
