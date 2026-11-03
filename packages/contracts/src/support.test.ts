import { describe, expect, it } from 'vitest';
import {
  SupportConversationSummarySchema,
  SupportConversationViewSchema,
  SupportReplyInputSchema,
} from './support.js';

describe('B11 support contracts', () => {
  it('parses a queue summary with a null last message', () => {
    expect(
      SupportConversationSummarySchema.safeParse({
        id: 'c1',
        state: 'waiting_for_analyst',
        stateVersion: 1,
        employee: { id: 'u1', name: 'Ana Souza' },
        handoff: {
          reason: 'employee_request',
          summary: 'Funcionário solicitou atendimento humano.',
          requestedAt: '2026-11-03T00:00:01.000Z',
        },
        assignedAnalystId: null,
        closedAt: null,
        lastMessage: null,
      }).success,
    ).toBe(true);
  });
  it('parses a conversation detail with messages and tickets', () => {
    expect(
      SupportConversationViewSchema.safeParse({
        conversation: {
          id: 'c1',
          state: 'with_analyst',
          stateVersion: 2,
          employee: { id: 'u1', name: 'Ana Souza' },
          handoff: {
            reason: 'employee_request',
            summary: 's',
            requestedAt: '2026-11-03T00:00:01.000Z',
          },
          assignedAnalystId: 'a1',
          closedAt: null,
          lastMessage: {
            content: 'oi',
            role: 'employee',
            createdAt: '2026-11-03T00:00:02.000Z',
          },
        },
        messages: [],
        tickets: [],
      }).success,
    ).toBe(true);
  });
  it('rejects a forged reply body', () => {
    expect(SupportReplyInputSchema.safeParse({ content: 'olá' }).success).toBe(true);
    expect(SupportReplyInputSchema.safeParse({ content: '   ' }).success).toBe(false);
    expect(SupportReplyInputSchema.safeParse({ content: 'olá', authorId: 'x' }).success).toBe(false);
  });
});
