import { describe, expect, it } from 'vitest';
import { MessageInputSchema, MessageViewSchema } from './conversation.js';

describe('B13 conversation contracts', () => {
  it('accepts content and rejects blank, oversized or forged input', () => {
    expect(MessageInputSchema.safeParse({ content: 'Olá' }).success).toBe(true);
    expect(MessageInputSchema.safeParse({ content: '  ' }).success).toBe(false);
    expect(MessageInputSchema.safeParse({ content: 'x'.repeat(4001) }).success).toBe(false);
    expect(MessageInputSchema.safeParse({ content: 'x', owner: 'other' }).success).toBe(false);
  });
  it('accepts ISO timestamps', () => {
    expect(MessageViewSchema.safeParse({ id: '1', content: 'Olá', createdAt: '2026-10-31T00:00:00.000Z' }).success).toBe(true);
  });
});
