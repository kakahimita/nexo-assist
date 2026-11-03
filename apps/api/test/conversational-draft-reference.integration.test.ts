import { describe, expect, it } from 'vitest';
import { UserViewSchema, type ConsultationDecisionView } from '@nexo/contracts';
import { DatabaseService } from '../src/database/database.service.js';
import { ConversationsService } from '../src/conversations/conversations.service.js';
import { createTestDatabase } from './support/test-database.js';

const decision: ConsultationDecisionView = {
  intent: 'Abertura',
  action: 'answer',
  appliedRule: 'IT',
  confidence: 0.8,
  justification: 'Rascunho',
  missingFacts: [],
  quickReplies: [],
  actions: [],
  evidence: [],
  tickets: [],
  outcome: 'completed',
  errorCode: null,
  source: 'deterministic',
  draftId: null,
};

describe('B13/B16: draft references in conversation history', () => {
  it('persists only references associated with this owner and conversation', async () => {
    const db = await createTestDatabase();
    const database = new DatabaseService(db.url);
    const service = new ConversationsService(database);
    try {
      const ana = UserViewSchema.parse(
        await database.client.user.findUniqueOrThrow({ where: { email: 'ana.souza@nexo.com.br' } }),
      );
      const bruno = UserViewSchema.parse(
        await database.client.user.findUniqueOrThrow({
          where: { email: 'bruno.lima@nexo.com.br' },
        }),
      );
      const conversation = await service.create(ana);
      const otherConversation = await service.create(bruno);
      const draft = await database.client.ticketDraft.create({ data: { ownerId: ana.id } });
      await database.client.draftProposalRun.create({
        data: { id: 'run-1', ownerId: ana.id, conversationId: conversation.id, draftId: draft.id },
      });
      const foreignDraft = await database.client.ticketDraft.create({
        data: { ownerId: bruno.id },
      });
      await database.client.draftProposalRun.create({
        data: {
          id: 'run-2',
          ownerId: bruno.id,
          conversationId: otherConversation.id,
          draftId: foreignDraft.id,
        },
      });
      const input = {
        content: 'Confira o rascunho',
        status: 'completed' as const,
        decision: { ...decision, draftId: draft.id },
        promptVersion: 'test',
        runId: 'run-1',
      };
      await expect(
        service.appendAgentTurn(ana, conversation.id, { ...input, runId: 'different-run' }),
      ).rejects.toThrow();
      await expect(
        service.appendAgentTurn(ana, conversation.id, {
          ...input,
          decision: { ...decision, draftId: 'forged' },
        }),
      ).rejects.toThrow();
      await expect(
        service.appendAgentTurn(ana, conversation.id, {
          ...input,
          decision: { ...decision, draftId: foreignDraft.id },
        }),
      ).rejects.toThrow();
      await service.appendAgentTurn(ana, conversation.id, input);
      expect((await service.messages(ana, conversation.id)).at(-1)?.decision?.draftId).toBe(
        draft.id,
      );
      await database.onModuleDestroy();
      const reopened = new DatabaseService(db.url);
      try {
        expect(
          (await new ConversationsService(reopened).messages(ana, conversation.id)).at(-1)?.decision
            ?.draftId,
        ).toBe(draft.id);
      } finally {
        await reopened.onModuleDestroy();
      }
    } finally {
      await database.onModuleDestroy();
      await db.cleanup();
    }
  });
});
