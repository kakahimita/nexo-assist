import { describe, expect, it } from 'vitest';
import type { ConsultationTicketView } from '@nexo/contracts';
import { resolveContextTicketId } from './context-ticket.js';

function ticket(id: string, status: ConsultationTicketView['status']): ConsultationTicketView {
  return {
    id,
    number: null,
    title: id,
    description: null,
    status,
    priority: 'medium',
    category: null,
    createdAt: null,
    deadline: '2026-11-07T12:00:00.000Z',
    lastUpdate: null,
    overdue: false,
  };
}

describe('context ticket resolution', () => {
  it('prefers an explicit ticket over any stored or decided ticket', () => {
    expect(
      resolveContextTicketId({
        explicit: 'explicit',
        decided: [ticket('decided', 'open')],
        existing: 'existing',
      }),
    ).toBe('explicit');
  });
  it('prefers a single active decided ticket over an older link', () => {
    expect(
      resolveContextTicketId({
        explicit: null,
        decided: [ticket('new', 'waiting_for_analyst'), ticket('closed', 'resolved')],
        existing: 'old',
      }),
    ).toBe('new');
  });
  it('keeps the older link when the decision is ambiguous or terminal', () => {
    expect(
      resolveContextTicketId({
        explicit: null,
        decided: [ticket('a', 'open'), ticket('b', 'in_progress')],
        existing: 'old',
      }),
    ).toBe('old');
    expect(
      resolveContextTicketId({
        explicit: null,
        decided: [ticket('a', 'approved')],
        existing: 'old',
      }),
    ).toBe('old');
  });
  it('returns null when nothing links the conversation', () => {
    expect(resolveContextTicketId({ explicit: null, decided: [], existing: null })).toBeNull();
  });
});
