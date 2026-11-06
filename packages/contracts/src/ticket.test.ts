import { describe, expect, it } from 'vitest';
import {
  ConfirmDraftInputSchema,
  DraftInputSchema,
  DraftViewSchema,
  TicketStatusSchema,
  TicketViewSchema,
  ticketStatusLabel,
} from './ticket.js';

describe('ticket status and number vocabulary', () => {
  const ticket = {
    id: 't1',
    ownerId: 'u1',
    title: 'VPN',
    description: 'Sem conexão',
    type: 'INC',
    category: 'network_vpn',
    priority: 'medium',
    impact: 'self',
    status: 'open',
    transferRequested: false,
    createdAt: '2026-11-01T12:00:00.000Z',
    resolvedAt: null,
    slaStartedAt: '2026-11-01T12:00:00.000Z',
    deadline: '2026-11-03T12:00:00.000Z',
    overdue: false,
  };
  it('accepts the five ticket statuses and rejects the old vocabulary', () => {
    for (const status of ['open', 'waiting_for_analyst', 'in_progress', 'approved', 'resolved']) {
      expect(TicketStatusSchema.parse(status)).toBe(status);
    }
    expect(TicketStatusSchema.safeParse('waiting').success).toBe(false);
  });
  it('labels every status in Brazilian Portuguese', () => {
    expect(ticketStatusLabel('open')).toBe('Aberto');
    expect(ticketStatusLabel('waiting_for_analyst')).toBe('Aguardando analista');
    expect(ticketStatusLabel('in_progress')).toBe('Em andamento');
    expect(ticketStatusLabel('approved')).toBe('Aprovado');
    expect(ticketStatusLabel('resolved')).toBe('Resolvido');
  });
  it('keeps legacy tickets without a number valid', () => {
    expect(TicketViewSchema.parse(ticket).number).toBeNull();
    expect(TicketViewSchema.parse({ ...ticket, number: 'INC-20311' }).number).toBe('INC-20311');
  });
});

describe('B04: strict ticket draft contracts', () => {
  const create = {
    action: 'create',
    title: 'VPN',
    description: 'Sem conexão',
    type: 'INC',
    category: 'network_vpn',
    impact: 'self',
    workState: 'stopped',
    urgency: 'normal',
  };
  it('accepts the four supported draft actions', () => {
    for (const input of [
      create,
      { action: 'supplement', ticketId: 't1', content: 'Detalhes' },
      { action: 'reopen', ticketId: 't1', reason: 'Voltou' },
      { action: 'transfer', ticketId: 't1', reason: 'Preciso de ajuda' },
    ]) {
      expect(DraftInputSchema.safeParse(input).success).toBe(true);
    }
  });
  it('rejects forged fields, empty text and invalid categories', () => {
    for (const input of [
      { ...create, ownerId: 'forged' },
      { ...create, title: ' ' },
      { ...create, description: 'x'.repeat(4001) },
      { ...create, title: 'x'.repeat(201) },
      { ...create, category: 'invalid' },
      { action: 'supplement', ticketId: 't1', content: '' },
    ]) {
      expect(DraftInputSchema.safeParse(input).success).toBe(false);
    }
  });
  it('validates the version and UUID used for confirmation', () => {
    const operationId = '5da80c1d-1d9d-4b57-97f1-f21bd36e1890';
    expect(ConfirmDraftInputSchema.safeParse({ version: 1, operationId }).success).toBe(true);
    expect(ConfirmDraftInputSchema.safeParse({ version: 0, operationId }).success).toBe(false);
    expect(ConfirmDraftInputSchema.safeParse({ version: 1, operationId: 'bad' }).success).toBe(
      false,
    );
    expect(
      ConfirmDraftInputSchema.safeParse({ version: 1, operationId, ownerId: 'x' }).success,
    ).toBe(false);
    expect(
      DraftViewSchema.safeParse({
        id: 'd1',
        version: 1,
        operationId,
        status: 'pending',
        input: create,
        priority: 'high',
        candidates: [],
      }).success,
    ).toBe(true);
    expect(
      DraftViewSchema.safeParse({
        id: 'd1',
        version: 1,
        operationId,
        status: 'pending',
        input: create,
      }).success,
    ).toBe(false);
  });
});
