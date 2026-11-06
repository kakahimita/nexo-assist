import { describe, expect, it } from 'vitest';
import { formatHandoffSummary } from './handoff-summary.js';

describe('handoff summaries', () => {
  it('keeps long conversations within the wire limit without losing the problem or latest outcome', () => {
    const summary = formatHandoffSummary({
      reason: 'unresolved_uncertainty',
      initialMessage: 'Meu projetor não liga. ' + 'x'.repeat(1000),
      latestMessage: 'A orientação não resolveu. ' + 'y'.repeat(1000),
      openTicketCount: 2,
      recentMessages: Array.from({ length: 8 }, () => ({
        role: 'agent',
        content: 'z'.repeat(2000),
      })),
    });
    expect(summary.length).toBeLessThanOrEqual(2000);
    expect(summary).toContain('Meu projetor não liga');
    expect(summary).toContain('A orientação não resolveu');
    expect(summary).toContain('2 chamado(s)');
  });
});
