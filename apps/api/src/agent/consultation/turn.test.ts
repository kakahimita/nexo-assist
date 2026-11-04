import { describe, expect, it } from 'vitest';
import { ConsultationTurn } from './turn.js';
const ticket = {
  id: 't1',
  title: 'Notebook',
  status: 'open',
  priority: 'medium',
  deadline: '2026-11-02T12:00:00.000Z',
  overdue: true,
};
const article = (id: string, applicability: string) => ({
  id,
  title: id,
  summary: '',
  body: '',
  platform: 'windows10',
  applicability,
  reason: '',
});
const decision = {
  intent: 'VPN',
  action: 'answer' as const,
  appliedRule: 'IT',
  confidence: 0.8,
  justification: 'Artigo',
  missingFacts: [],
  quickReplies: [],
};
describe('B12: decisions use actual tool results', () => {
  it('exposes a draft reference only for a successful validated proposal result', () => {
    const turn = new ConsultationTurn();
    turn.apply({
      type: 'tool-result',
      toolCallId: 'd',
      tool: 'propose-ticket-draft',
      result: { status: 'draft', draftId: 'draft-1' },
    } as never);
    turn.apply({ type: 'decision', decision });
    expect(turn.snapshot()).toMatchObject({
      draftId: 'draft-1',
      actions: [{ tool: 'propose-ticket-draft', status: 'succeeded' }],
    });
    const failed = new ConsultationTurn();
    failed.apply({
      type: 'tool-result',
      toolCallId: 'f',
      tool: 'propose-ticket-draft',
      result: { status: 'draft', draftId: 'forged' },
      isError: true,
    } as never);
    failed.apply({ type: 'decision', decision });
    expect(failed.snapshot()).toMatchObject({ draftId: null, actions: [{ status: 'failed' }] });
  });
  it('keeps the clock start of duplicate candidates as their last update', () => {
    const turn = new ConsultationTurn();
    turn.apply({
      type: 'tool-result',
      toolCallId: 'd',
      tool: 'propose-ticket-draft',
      result: {
        status: 'duplicate_candidates',
        candidates: [
          {
            id: 't2',
            ownerId: 'ana',
            title: 'Notebook',
            description: 'Lento',
            type: 'INC',
            category: 'hardware',
            priority: 'medium',
            impact: 'self',
            status: 'open',
            transferRequested: false,
            createdAt: '2026-10-20T12:00:00.000Z',
            resolvedAt: null,
            slaStartedAt: '2026-11-01T12:00:00.000Z',
            deadline: '2026-11-04T12:00:00.000Z',
            overdue: false,
          },
        ],
      },
    } as never);
    turn.apply({ type: 'decision', decision });
    expect(turn.snapshot().tickets).toEqual([
      expect.objectContaining({ id: 't2', lastUpdate: '2026-11-01T12:00:00.000Z' }),
    ]);
  });
  it('does not offer a misleading creation shortcut while duplicate candidates need review', () => {
    const turn = new ConsultationTurn();
    turn.apply({
      type: 'tool-result',
      toolCallId: 'd',
      tool: 'propose-ticket-draft',
      result: { status: 'duplicate_candidates', candidates: [] },
    });
    turn.apply({
      type: 'decision',
      decision: {
        ...decision,
        quickReplies: ['Sim, quero criar um novo', 'Ver chamados existentes'],
      },
    });
    expect(turn.snapshot().decision.quickReplies).toEqual(['Ver chamados existentes']);
  });
  it('joins text and derives de-duplicated ticket actions and evidence', () => {
    const turn = new ConsultationTurn();
    turn.apply({ type: 'text-delta', text: 'Olá' });
    turn.apply({ type: 'text-delta', text: ' mundo' });
    const event = {
      type: 'tool-result',
      toolCallId: '1',
      tool: 'consult-tickets',
      result: { match: 'one', requestedQuery: null, tickets: [ticket] },
    } as const;
    turn.apply(event);
    turn.apply(event);
    turn.apply({ type: 'decision', decision });
    expect(turn.snapshot()).toMatchObject({
      text: 'Olá mundo',
      actions: [{ id: '1', status: 'succeeded' }],
      evidence: [{ kind: 'ticket', id: 't1' }],
      tickets: [ticket],
      decision,
    });
    expect(turn.snapshot().actions).toHaveLength(1);
  });
  it('uses only applicable article evidence and never turns failures into success', () => {
    const turn = new ConsultationTurn();
    turn.apply({
      type: 'tool-result',
      toolCallId: 'a',
      tool: 'search-knowledge',
      result: {
        platform: 'windows11',
        matches: [article('ok', 'applicable'), article('wrong', 'platform_mismatch')],
      },
    });
    turn.apply({
      type: 'tool-result',
      toolCallId: 'b',
      tool: 'search-knowledge',
      result: { error: true },
      isError: true,
    });
    turn.apply({ type: 'decision', decision });
    expect(turn.snapshot().evidence).toEqual([{ kind: 'article', id: 'ok', title: 'ok' }]);
    expect(turn.snapshot().actions.map((action) => action.status)).toEqual(['succeeded', 'failed']);
  });
  it('rejects missing and forged structured decisions', () => {
    expect(() => new ConsultationTurn().snapshot()).toThrow('invalid_output');
    const turn = new ConsultationTurn();
    expect(() =>
      turn.apply({ type: 'decision', decision: { ...decision, evidence: ['fake'] } } as never),
    ).toThrow('invalid_output');
  });
  it('removes quick replies offering unsupported ticket writes or human handoff', () => {
    const turn = new ConsultationTurn();
    turn.apply({
      type: 'decision',
      decision: {
        ...decision,
        quickReplies: ['Abrir chamado', 'Criar novo chamado', 'Falar com atendente', 'Windows 11'],
      },
    });
    expect(turn.snapshot().decision.quickReplies).toEqual(['Windows 11']);
  });
  it('does not offer device operations the assistant cannot execute', () => {
    const turn = new ConsultationTurn();
    turn.apply({
      type: 'decision',
      decision: {
        ...decision,
        quickReplies: ['Reinstalar cliente VPN', 'Reiniciar o computador', 'Preciso de ajuda'],
      },
    });
    expect(turn.snapshot().decision.quickReplies).toEqual(['Preciso de ajuda']);
  });
});
