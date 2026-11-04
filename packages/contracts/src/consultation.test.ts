import { describe, expect, it } from 'vitest';
import {
  ConsultationDecisionViewSchema,
  ConsultationEngineDecisionSchema,
  ConsultationTicketViewSchema,
} from './consultation.js';
import { MessageViewSchema } from './conversation.js';
import { TicketChangeInputSchema } from './ticket.js';

const decision = {
  intent: 'VPN',
  action: 'answer',
  appliedRule: 'IT',
  confidence: 0.8,
  justification: 'Article',
  missingFacts: [],
  quickReplies: [],
  actions: [
    {
      id: '1',
      tool: 'search-knowledge',
      status: 'succeeded',
      label: 'Busca',
      summary: 'Encontrado',
    },
  ],
  evidence: [{ kind: 'article', id: 'kb-1', title: 'VPN' }],
  tickets: [],
  outcome: 'completed',
  errorCode: null,
  source: 'deterministic',
};
const base = { id: '1', content: 'Olá', createdAt: '2026-10-31T00:00:00.000Z' };
describe('B12/B13: consultation wire contracts', () => {
  it('accepts only supported draft proposals and keeps draft references out of model decisions', () => {
    expect(
      TicketChangeInputSchema.safeParse({
        action: 'supplement',
        ticketId: 'ticket-1',
        content: 'Mais detalhes',
      }).success,
    ).toBe(true);
    expect(
      TicketChangeInputSchema.safeParse({
        action: 'reopen',
        ticketId: 'ticket-1',
        reason: 'Voltou',
      }).success,
    ).toBe(true);
    expect(
      TicketChangeInputSchema.safeParse({ action: 'transfer', ticketId: 'ticket-1', reason: 'x' })
        .success,
    ).toBe(false);
    expect(
      ConsultationDecisionViewSchema.safeParse({
        ...decision,
        draftId: 'draft-1',
        actions: [{ ...decision.actions[0], tool: 'propose-ticket-draft' }],
      }).success,
    ).toBe(true);
    expect(
      ConsultationEngineDecisionSchema.safeParse({
        intent: 'x',
        action: 'answer',
        appliedRule: 'x',
        confidence: 0.8,
        justification: 'x',
        missingFacts: [],
        quickReplies: [],
        draftId: 'forged',
      }).success,
    ).toBe(false);
  });
  it('accepts complete decisions and both message roles', () => {
    expect(ConsultationDecisionViewSchema.safeParse(decision).success).toBe(true);
    expect(
      MessageViewSchema.safeParse({
        ...base,
        role: 'employee',
        status: 'completed',
        decision: null,
        authorName: null,
      }).success,
    ).toBe(true);
    expect(
      MessageViewSchema.safeParse({
        ...base,
        role: 'agent',
        status: 'completed',
        decision,
        authorName: null,
      }).success,
    ).toBe(true);
    expect(MessageViewSchema.safeParse(base).success).toBe(false);
  });
  it('keeps the ticket last update and accepts tickets stored before it existed', () => {
    const ticket = {
      id: 'INC-1',
      title: 'Notebook lento',
      status: 'open',
      priority: 'medium',
      deadline: '2026-11-03T12:00:00.000Z',
      overdue: true,
    };
    expect(
      ConsultationTicketViewSchema.parse({ ...ticket, lastUpdate: '2026-11-01T12:00:00.000Z' })
        .lastUpdate,
    ).toBe('2026-11-01T12:00:00.000Z');
    const legacy = ConsultationTicketViewSchema.parse(ticket);
    expect(legacy.lastUpdate).toBeNull();
    expect(legacy.category).toBeNull();
    expect(legacy.createdAt).toBeNull();
  });
  it('preserves the ticket category and creation date and rejects unknown values', () => {
    const ticket = {
      id: 'INC-1',
      title: 'Notebook lento',
      status: 'open',
      priority: 'medium',
      deadline: '2026-11-03T12:00:00.000Z',
      overdue: true,
    };
    expect(
      ConsultationTicketViewSchema.parse({
        ...ticket,
        category: 'hardware',
        createdAt: '2026-11-04T01:00:00.000Z',
      }),
    ).toMatchObject({ category: 'hardware', createdAt: '2026-11-04T01:00:00.000Z' });
    expect(ConsultationTicketViewSchema.safeParse({ ...ticket, category: 'printer' }).success).toBe(
      false,
    );
    expect(
      ConsultationTicketViewSchema.safeParse({ ...ticket, createdAt: '04/11/2026' }).success,
    ).toBe(false);
  });
  it('rejects invalid or forged decisions', () => {
    for (const patch of [
      { confidence: -0.1 },
      { confidence: 1.1 },
      { action: 'write' },
      { ownerId: 'other' },
      { quickReplies: ['1', '2', '3', '4', '5'] },
      { outcome: 'failed' },
      { errorCode: 'quota' },
      { actions: [{ ...decision.actions[0], tool: 'write-ticket' }] },
    ]) {
      expect(ConsultationDecisionViewSchema.safeParse({ ...decision, ...patch }).success).toBe(
        false,
      );
    }
  });
});
