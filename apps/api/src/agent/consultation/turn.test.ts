import { describe, expect, it } from 'vitest';
import { ConsultationTurn } from './turn.js';
const ticket = { id: 't1', title: 'Notebook', status: 'open', priority: 'medium', deadline: '2026-11-02T12:00:00.000Z', overdue: true };
const article = (id: string, applicability: string) => ({ id, title: id, summary: '', body: '', platform: 'windows10', applicability, reason: '' });
const decision = { intent: 'VPN', action: 'answer' as const, appliedRule: 'IT', confidence: 0.8, justification: 'Artigo', missingFacts: [], quickReplies: [] };
describe('B12: decisions use actual tool results', () => {
  it('joins text and derives de-duplicated ticket actions and evidence', () => {
    const turn = new ConsultationTurn();
    turn.apply({ type: 'text-delta', text: 'Olá' }); turn.apply({ type: 'text-delta', text: ' mundo' });
    const event = { type: 'tool-result', toolCallId: '1', tool: 'consult-tickets', result: { match: 'one', requestedQuery: null, tickets: [ticket] } } as const;
    turn.apply(event); turn.apply(event); turn.apply({ type: 'decision', decision });
    expect(turn.snapshot()).toMatchObject({ text: 'Olá mundo', actions: [{ id: '1', status: 'succeeded' }], evidence: [{ kind: 'ticket', id: 't1' }], tickets: [ticket], decision });
    expect(turn.snapshot().actions).toHaveLength(1);
  });
  it('uses only applicable article evidence and never turns failures into success', () => {
    const turn = new ConsultationTurn();
    turn.apply({ type: 'tool-result', toolCallId: 'a', tool: 'search-knowledge', result: { platform: 'windows11', matches: [article('ok', 'applicable'), article('wrong', 'platform_mismatch')] } });
    turn.apply({ type: 'tool-result', toolCallId: 'b', tool: 'search-knowledge', result: { error: true }, isError: true });
    turn.apply({ type: 'decision', decision });
    expect(turn.snapshot().evidence).toEqual([{ kind: 'article', id: 'ok', title: 'ok' }]);
    expect(turn.snapshot().actions.map((action) => action.status)).toEqual(['succeeded', 'failed']);
  });
  it('rejects missing and forged structured decisions', () => {
    expect(() => new ConsultationTurn().snapshot()).toThrow('invalid_output');
    const turn = new ConsultationTurn();
    expect(() => turn.apply({ type: 'decision', decision: { ...decision, evidence: ['fake'] } } as never)).toThrow('invalid_output');
  });
});
