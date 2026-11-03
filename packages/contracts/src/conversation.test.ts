import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_MESSAGE_LIMIT,
  ConversationViewSchema,
  HandoffViewSchema,
  RequestHandoffInputSchema,
  SessionLimitResponseSchema,
  MessageInputSchema,
  MessageViewSchema,
} from './conversation.js';

describe('B13 conversation contracts', () => {
  it('accepts content and rejects blank, oversized or forged input', () => {
    expect(MessageInputSchema.safeParse({ content: 'Olá' }).success).toBe(true);
    expect(MessageInputSchema.safeParse({ content: '  ' }).success).toBe(false);
    expect(MessageInputSchema.safeParse({ content: 'x'.repeat(4001) }).success).toBe(false);
    expect(MessageInputSchema.safeParse({ content: 'x', owner: 'other' }).success).toBe(false);
  });
  it('accepts ISO timestamps', () => {
    expect(
      MessageViewSchema.safeParse({
        id: '1',
        content: 'Olá',
        createdAt: '2026-10-31T00:00:00.000Z',
        role: 'employee',
        status: 'completed',
        decision: null,
        authorName: null,
      }).success,
    ).toBe(true);
  });
  it('accepts an analyst message with its author name', () => {
    expect(
      MessageViewSchema.safeParse({
        id: '2',
        content: 'Já li o histórico.',
        createdAt: '2026-10-31T00:00:01.000Z',
        role: 'analyst',
        status: 'completed',
        decision: null,
        authorName: 'Rafael Lima',
      }).success,
    ).toBe(true);
  });
  it('accepts a server-owned waiting lifecycle and rejects forged handoff metadata', () => {
    expect(
      ConversationViewSchema.safeParse({
        id: 'conversation-1',
        createdAt: '2026-11-03T00:00:00.000Z',
        state: 'waiting_for_analyst',
        stateVersion: 1,
        handoff: {
          reason: 'employee_request',
          summary: 'Funcionário solicitou atendimento humano.',
          requestedAt: '2026-11-03T00:00:01.000Z',
        },
        assignedAnalystId: null,
        closedAt: null,
      }).success,
    ).toBe(true);
    expect(HandoffViewSchema.safeParse({ reason: 'unknown', summary: 'x' }).success).toBe(false);
    expect(
      RequestHandoffInputSchema.safeParse({
        reason: 'employee_request',
        summary: 'forged',
      }).success,
    ).toBe(false);
  });
  it('accepts with_analyst and closed states and rejects an unknown state', () => {
    expect(
      ConversationViewSchema.safeParse({
        id: 'conversation-2',
        createdAt: '2026-11-03T00:00:00.000Z',
        state: 'with_analyst',
        stateVersion: 2,
        handoff: {
          reason: 'employee_request',
          summary: 'Funcionário solicitou atendimento humano.',
          requestedAt: '2026-11-03T00:00:01.000Z',
        },
        assignedAnalystId: 'analyst-1',
        closedAt: null,
      }).success,
    ).toBe(true);
    expect(
      ConversationViewSchema.safeParse({
        id: 'conversation-3',
        createdAt: '2026-11-03T00:00:00.000Z',
        state: 'closed',
        stateVersion: 3,
        handoff: null,
        assignedAnalystId: 'analyst-1',
        closedAt: '2026-11-03T00:05:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      ConversationViewSchema.safeParse({
        id: 'conversation-4',
        createdAt: '2026-11-03T00:00:00.000Z',
        state: 'unknown',
        stateVersion: 1,
        handoff: null,
        assignedAnalystId: null,
        closedAt: null,
      }).success,
    ).toBe(false);
  });
});

it('validates the session-limit response', () => {
  expect(CONVERSATION_MESSAGE_LIMIT).toBe(30);
  expect(
    SessionLimitResponseSchema.safeParse({ code: 'session_limit', limit: 30, used: 30 }).success,
  ).toBe(true);
  expect(SessionLimitResponseSchema.safeParse({ code: 'other', limit: 30, used: 30 }).success).toBe(
    false,
  );
});
