import { randomUUID } from 'node:crypto';
import { DraftInputSchema, DraftViewSchema, type ConfirmDraftInput, type DraftInput, type DraftView, type TicketView, type UserView } from '@nexo/contracts';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { findTicketCandidates } from './ticket-candidates.js';
import { classifyPriority } from './rules.js';
import { assertEmployee, TicketService } from './ticket-service.js';

@Injectable()
export class DraftsService {
  private proposalQueue: Promise<void> = Promise.resolve();
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(TicketService) private readonly tickets: TicketService) {}

  private async prepare(user: UserView, input: DraftInput): Promise<{ input: DraftInput; priority: string | null }> {
    assertEmployee(user);
    const parsed = DraftInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException();
    if (parsed.data.action === 'create') {
      const priority = classifyPriority(parsed.data);
      if (!priority) throw new BadRequestException();
      return { input: parsed.data, priority };
    }
    await this.tickets.get(user, parsed.data.ticketId, new Date());
    return { input: parsed.data, priority: null };
  }

  async create(user: UserView, input: DraftInput): Promise<DraftView> {
    const prepared = await this.prepare(user, input);
    const draft = await this.database.client.ticketDraft.create({ data: { ownerId: user.id, versions: { create: { version: 1, operationId: randomUUID(), inputJson: JSON.stringify(prepared.input), priority: prepared.priority } } } });
    return this.get(user, draft.id);
  }

  async createForRun(user: UserView, input: DraftInput, context: { conversationId: string; runId: string }): Promise<DraftView> {
    const prepared = await this.prepare(user, input);
    const operation = this.proposalQueue.then(() => this.database.client.$transaction(async (tx) => {
      if (!await tx.conversation.findFirst({ where: { id: context.conversationId, ownerId: user.id }, select: { id: true } })) throw new NotFoundException();
      const existing = await tx.draftProposalRun.findUnique({ where: { id: context.runId }, include: { draft: { include: { versions: true } } } });
      if (existing) {
        const first = existing.draft.versions.find((version) => version.version === 1);
        if (existing.ownerId !== user.id || existing.conversationId !== context.conversationId || !first || first.inputJson !== JSON.stringify(prepared.input)) throw new ConflictException();
        return existing.draftId;
      }
      const draft = await tx.ticketDraft.create({ data: { ownerId: user.id, versions: { create: { version: 1, operationId: randomUUID(), inputJson: JSON.stringify(prepared.input), priority: prepared.priority } } } });
      await tx.draftProposalRun.create({ data: { id: context.runId, ownerId: user.id, conversationId: context.conversationId, draftId: draft.id } });
      return draft.id;
    }));
    this.proposalQueue = operation.then(() => undefined, () => undefined);
    return this.get(user, await operation);
  }

  async get(user: UserView, id: string): Promise<DraftView> {
    assertEmployee(user);
    const draft = await this.database.client.ticketDraft.findFirst({ where: { id, ownerId: user.id }, include: { versions: true } });
    if (!draft) throw new NotFoundException();
    const current = draft.versions.find((item) => item.version === draft.version);
    if (!current) throw new Error('Draft version missing');
    const input = DraftInputSchema.parse(JSON.parse(current.inputJson) as unknown);
    const matches = input.action === 'create'
      ? findTicketCandidates(input, await this.tickets.list(user, new Date()))
      : undefined;
    return DraftViewSchema.parse({ id: draft.id, version: draft.version, status: draft.status, operationId: current.operationId, input, ...(input.action === 'create' ? { priority: current.priority, candidates: matches?.map(({ ticket }) => ticket), candidateMatches: matches?.map(({ ticket, match }) => ({ id: ticket.id, match })) } : {}) });
  }

  async edit(user: UserView, id: string, expectedVersion: number, input: DraftInput): Promise<DraftView> {
    await this.get(user, id);
    const prepared = await this.prepare(user, input);
    await this.database.client.$transaction(async (tx) => {
      const updated = await tx.ticketDraft.updateMany({ where: { id, ownerId: user.id, version: expectedVersion, status: 'pending' }, data: { version: { increment: 1 } } });
      if (updated.count !== 1) throw new ConflictException();
      await tx.ticketDraftVersion.create({ data: { draftId: id, version: expectedVersion + 1, operationId: randomUUID(), inputJson: JSON.stringify(prepared.input), priority: prepared.priority } });
    });
    return this.get(user, id);
  }

  async cancel(user: UserView, id: string, expectedVersion: number): Promise<DraftView> {
    await this.get(user, id);
    const updated = await this.database.client.ticketDraft.updateMany({ where: { id, ownerId: user.id, version: expectedVersion, status: 'pending' }, data: { status: 'cancelled' } });
    if (updated.count !== 1) throw new ConflictException();
    return this.get(user, id);
  }

  async confirm(user: UserView, id: string, input: ConfirmDraftInput, now: Date): Promise<TicketView> {
    return this.tickets.confirm(user, id, input, now);
  }
}
