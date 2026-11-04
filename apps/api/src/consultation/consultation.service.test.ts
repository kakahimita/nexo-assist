import { describe, expect, it } from 'vitest';
import type { ConsultationEngine, ConsultationEngineEvent } from '../agent/consultation/types.js';
import { ConsultationService } from './consultation.service.js';

const user = { id: 'ana', email: 'ana@example.com', name: 'Ana', role: 'employee' as const };
const ticket = {
  id: 'INC-1',
  title: 'Notebook lento',
  status: 'open',
  priority: 'medium',
  deadline: '2026-10-30T12:00:00.000Z',
  lastUpdate: '2026-10-20T12:00:00.000Z',
  overdue: true,
};
const other = { ...ticket, id: 'INC-2', title: 'Senha bloqueada', overdue: false };
const consult = (tickets: unknown[], match = 'one') =>
  ({
    type: 'tool-result',
    toolCallId: 'c1',
    tool: 'consult-tickets',
    result: { match, requestedQuery: null, tickets },
  }) as const satisfies ConsultationEngineEvent;
const answer = {
  type: 'decision',
  decision: {
    intent: 'Consulta de chamado',
    action: 'answer',
    appliedRule: 'Somente chamados do funcionário',
    confidence: 0.9,
    justification: 'Chamado identificado.',
    missingFacts: [],
    quickReplies: [],
  },
} as const satisfies ConsultationEngineEvent;

function fakeEngine(events: ConsultationEngineEvent[]): ConsultationEngine {
  return {
    source: 'deterministic',
    promptVersion: 'test',
    async *run() {
      yield* events;
    },
  };
}

function fakeConversations(current = true) {
  const appended: Array<{ content: string; decision: { tickets: unknown[] } }> = [];
  const handoffs: string[] = [];
  return {
    appended,
    handoffs,
    conversations: {
      messages: async () => [],
      appendAgentTurnIfCurrent: async (
        _user: unknown,
        _conversationId: string,
        _stateVersion: number,
        input: { content: string; decision: { tickets: unknown[] } },
      ) => {
        appended.push(input);
        return current
          ? {
              id: 'agent-1',
              content: input.content,
              role: 'agent',
              status: 'completed',
              decision: input.decision,
              createdAt: '2026-11-04T12:00:00.000Z',
              authorName: null,
            }
          : null;
      },
      requestHandoff: async (_user: unknown, _conversationId: string, reason: string) => {
        handoffs.push(reason);
        return {};
      },
    },
  };
}

async function run(
  events: ConsultationEngineEvent[],
  current = true,
): Promise<{
  types: string[];
  appended: ReturnType<typeof fakeConversations>['appended'];
  handoffs: string[];
}> {
  const fake = fakeConversations(current);
  const service = new ConsultationService(fake.conversations as never, fakeEngine(events));
  const types: string[] = [];
  for await (const event of service.run(
    user,
    'conversation-1',
    {} as never,
    new AbortController().signal,
    'run-1',
    0,
  ))
    types.push(event.type);
  return { types, appended: fake.appended, handoffs: fake.handoffs };
}

describe('B09/B10: overdue consulted tickets are transferred by the backend', () => {
  it('saves a deterministic message with the ticket, then transfers, ignoring model text', async () => {
    const result = await run([
      consult([ticket]),
      { type: 'text-delta', text: 'Seu chamado está em dia.' },
      answer,
      { type: 'finish' },
    ]);
    expect(result.handoffs).toEqual(['overdue_ticket']);
    expect(result.appended).toHaveLength(1);
    expect(result.appended[0]!.content).toContain('Notebook lento está com o prazo vencido');
    expect(result.appended[0]!.content).not.toContain('em dia');
    expect(result.appended[0]!.decision.tickets).toEqual([ticket]);
    expect(result.types).toEqual(['user-message', 'done', 'handoff-waiting']);
  });
  it('does not transfer when several tickets match, even if one is overdue', async () => {
    const result = await run([
      consult([ticket, other], 'multiple'),
      { type: 'text-delta', text: 'Qual chamado você deseja consultar?' },
      answer,
      { type: 'finish' },
    ]);
    expect(result.handoffs).toEqual([]);
    expect(result.appended[0]!.content).toBe('Qual chamado você deseja consultar?');
  });
  it('stops without a second handoff when the conversation changed before saving', async () => {
    const result = await run([consult([ticket]), answer, { type: 'finish' }], false);
    expect(result.handoffs).toEqual([]);
    expect(result.types).toEqual(['user-message', 'handoff-waiting']);
  });
});
