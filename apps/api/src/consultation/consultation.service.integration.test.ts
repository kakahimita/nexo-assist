import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../test/support/test-database.js';
import type { ConsultationEngine } from '../agent/consultation/types.js';
import { createFixtureConsultation } from '../agent/consultation/fixture-consultation.js';
import { ConsultationTools } from '../agent/tools/consultation-tools.js';
import { ConversationsService } from '../conversations/conversations.service.js';
import { DatabaseService } from '../database/database.service.js';
import { KnowledgeService } from '../knowledge/knowledge.service.js';
import { DraftsService } from '../tickets/drafts.service.js';
import { FailureSimulator } from '../tickets/failure-simulator.js';
import { PrismaTicketService } from '../tickets/prisma-ticket-service.js';
import { ConsultationService } from './consultation.service.js';

describe('B09/B10/B13/B16: overdue transfer persists and stays private', () => {
  it('transfers the overdue ticket once and restores the waiting conversation', async () => {
    const db = await createTestDatabase();
    const database = new DatabaseService(db.url);
    try {
      const row = await database.client.user.findUniqueOrThrow({
        where: { email: 'ana.souza@nexo.com.br' },
      });
      const user = { id: row.id, email: row.email, name: row.name, role: 'employee' as const };
      const ticketService = new PrismaTicketService(database, new FailureSimulator());
      const tools = new ConsultationTools(
        ticketService,
        new KnowledgeService(database),
        new DraftsService(database, ticketService),
        database,
      );
      const conversations = new ConversationsService(database);
      const service = new ConsultationService(conversations, createFixtureConsultation(tools));
      const conversation = await conversations.create(user);
      const message = await conversations.append(
        user,
        conversation.id,
        'Qual o status do Notebook lento?',
      );
      const stateVersion = await conversations.captureAgentRun(user, conversation.id);
      const events = [];
      for await (const event of service.run(
        user,
        conversation.id,
        message,
        new AbortController().signal,
        'run-1',
        stateVersion!,
      ))
        events.push(event);
      expect(events.map((event) => event.type)).toEqual([
        'user-message',
        'done',
        'handoff-waiting',
      ]);
      expect(
        await database.client.conversation.findUniqueOrThrow({ where: { id: conversation.id } }),
      ).toMatchObject({ state: 'waiting_for_analyst', handoffReason: 'overdue_ticket' });
      const restored = (await conversations.messages(user, conversation.id)).filter(
        (item) => item.role === 'agent',
      );
      expect(restored).toHaveLength(1);
      expect(restored[0]!.decision).toMatchObject({
        action: 'handoff',
        tickets: [expect.objectContaining({ id: 'fixture-ana-open', overdue: true })],
      });
      expect(await conversations.captureAgentRun(user, conversation.id)).toBeNull();
    } finally {
      await database.onModuleDestroy();
      await db.cleanup();
    }
  });
  it('never transfers because of another employee overdue ticket', async () => {
    const db = await createTestDatabase();
    const database = new DatabaseService(db.url);
    try {
      const row = await database.client.user.findUniqueOrThrow({
        where: { email: 'ana.souza@nexo.com.br' },
      });
      const user = { id: row.id, email: row.email, name: row.name, role: 'employee' as const };
      const old = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      await database.client.ticket.update({
        where: { id: 'fixture-bruno-open' },
        data: { createdAt: old, slaStartedAt: old },
      });
      const ticketService = new PrismaTicketService(database, new FailureSimulator());
      const tools = new ConsultationTools(
        ticketService,
        new KnowledgeService(database),
        new DraftsService(database, ticketService),
        database,
      );
      const replay: ConsultationEngine = {
        source: 'deterministic',
        promptVersion: 'test',
        async *run() {
          yield {
            type: 'tool-result',
            toolCallId: 't1',
            tool: 'consult-tickets',
            result: await tools.consultTickets(user, { query: 'Acesso à VPN' }, new Date()),
          };
          yield {
            type: 'decision',
            decision: {
              intent: 'Consulta de chamado',
              action: 'clarify',
              appliedRule: 'Somente chamados do funcionário',
              confidence: 0.5,
              justification: 'Nenhum chamado encontrado.',
              missingFacts: ['chamado'],
              quickReplies: [],
            },
          };
          yield { type: 'text-delta', text: 'Não encontrei esse chamado.' };
          yield { type: 'finish' };
        },
      };
      const conversations = new ConversationsService(database);
      const service = new ConsultationService(conversations, replay);
      const conversation = await conversations.create(user);
      const message = await conversations.append(user, conversation.id, 'Acesso à VPN');
      const stateVersion = await conversations.captureAgentRun(user, conversation.id);
      const types: string[] = [];
      for await (const event of service.run(
        user,
        conversation.id,
        message,
        new AbortController().signal,
        'run-2',
        stateVersion!,
      ))
        types.push(event.type);
      expect(types[0]).toBe('user-message');
      expect(types).toContain('action');
      expect(types.at(-1)).toBe('done');
      expect(types).not.toContain('handoff-waiting');
      expect(
        await database.client.conversation.findUniqueOrThrow({ where: { id: conversation.id } }),
      ).toMatchObject({ state: 'agent', handoffReason: null });
    } finally {
      await database.onModuleDestroy();
      await db.cleanup();
    }
  });
});
