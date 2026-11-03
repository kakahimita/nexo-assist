import { describe, expect, it } from 'vitest';
import { ConsultationDecisionViewSchema } from './consultation.js';
import { MessageViewSchema } from './conversation.js';

const decision = { intent: 'VPN', action: 'answer', appliedRule: 'IT', confidence: 0.8, justification: 'Article', missingFacts: [], quickReplies: [], actions: [{ id: '1', tool: 'search-knowledge', status: 'succeeded', label: 'Busca', summary: 'Encontrado' }], evidence: [{ kind: 'article', id: 'kb-1', title: 'VPN' }], tickets: [], outcome: 'completed', errorCode: null, source: 'deterministic' };
const base = { id: '1', content: 'Olá', createdAt: '2026-10-31T00:00:00.000Z' };
describe('B12/B13: consultation wire contracts', () => {
  it('accepts complete decisions and both message roles', () => {
    expect(ConsultationDecisionViewSchema.safeParse(decision).success).toBe(true);
    expect(MessageViewSchema.safeParse({ ...base, role: 'employee', status: 'completed', decision: null }).success).toBe(true);
    expect(MessageViewSchema.safeParse({ ...base, role: 'agent', status: 'completed', decision }).success).toBe(true);
    expect(MessageViewSchema.safeParse(base).success).toBe(false);
  });
  it('rejects invalid or forged decisions', () => {
    for (const patch of [{ confidence: -0.1 }, { confidence: 1.1 }, { action: 'write' }, { ownerId: 'other' }, { quickReplies: ['1', '2', '3', '4', '5'] }, { outcome: 'failed' }, { errorCode: 'quota' }, { actions: [{ ...decision.actions[0], tool: 'write-ticket' }] }]) {
      expect(ConsultationDecisionViewSchema.safeParse({ ...decision, ...patch }).success).toBe(false);
    }
  });
});
