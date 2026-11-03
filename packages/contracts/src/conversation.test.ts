import { describe, expect, it } from 'vitest';
import { CONVERSATION_MESSAGE_LIMIT, SessionLimitResponseSchema, MessageInputSchema, MessageViewSchema } from './conversation.js';

describe('B13 conversation contracts', () => {
  it('accepts content and rejects blank, oversized or forged input', () => {
    expect(MessageInputSchema.safeParse({ content: 'OlÃ¡' }).success).toBe(true);
    expect(MessageInputSchema.safeParse({ content: '  ' }).success).toBe(false);
    expect(MessageInputSchema.safeParse({ content: 'x'.repeat(4001) }).success).toBe(false);
    expect(MessageInputSchema.safeParse({ content: 'x', owner: 'other' }).success).toBe(false);
  });
  it('accepts ISO timestamps', () => {
    expect(MessageViewSchema.safeParse({ id: '1', content: 'OlÃ¡', createdAt: '2026-10-31T00:00:00.000Z', role: 'employee', status: 'completed', decision: null }).success).toBe(true);
  });
});

it('validates the session-limit response', () => {
  expect(CONVERSATION_MESSAGE_LIMIT).toBe(30);
  expect(SessionLimitResponseSchema.safeParse({ code: 'session_limit', limit: 30, used: 30 }).success).toBe(true);
  expect(SessionLimitResponseSchema.safeParse({ code: 'other', limit: 30, used: 30 }).success).toBe(false);
});
