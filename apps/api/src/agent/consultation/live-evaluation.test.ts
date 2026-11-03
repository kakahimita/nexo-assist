import { describe, expect, it } from 'vitest';
import { validateLiveCase } from './live-evaluation.js';
import type { ConsultationEngineDecision } from '@nexo/contracts';
const decision: ConsultationEngineDecision = { intent: 'VPN', action: 'answer', appliedRule: 'Windows', confidence: 0.8, justification: 'Artigo', missingFacts: [], quickReplies: [] };
const snapshot = { text: 'Orientação para Windows 11', actions: [{ id: 'a', tool: 'search-knowledge' as const, status: 'succeeded' as const, label: 'Busca', summary: 'ok' }], evidence: [{ kind: 'article' as const, id: 'kb-vpn-809-windows-11', title: 'Windows 11' }], tickets: [], decision };
describe('live evaluation assertions', () => {
  it('accepts applicable Windows evidence and rejects the wrong platform', () => {
    expect(validateLiveCase('vpn11', snapshot)).toEqual([]);
    expect(validateLiveCase('vpn10', snapshot)).not.toEqual([]);
  });
  it('rejects other employees tickets and fake evidence', () => {
    const foreign = { ...snapshot, tickets: [{ id: 'fixture-bruno-open', title: 'VPN', status: 'open' as const, priority: 'low' as const, deadline: '2026-11-02T12:00:00.000Z', overdue: false }], evidence: [{ kind: 'ticket' as const, id: 'fixture-bruno-open', title: 'VPN' }] };
    expect(validateLiveCase('status', foreign)).not.toEqual([]);
  });
});
