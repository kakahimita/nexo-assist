import { randomUUID } from 'node:crypto';
import { DraftInputSchema, DraftViewSchema, type DraftInput, type DraftView, type UserView } from '@nexo/contracts';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { normalizeTitle } from './normalize-title.js';
import { classifyPriority } from './rules.js';
import { assertEmployee, TicketService } from './ticket-service.js';

@Injectable()
export class DraftsService {
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

  async get(user: UserView, id: string): Promise<DraftView> {
    assertEmployee(user);
    const draft = await this.database.client.ticketDraft.findFirst({ where: { id, ownerId: user.id }, include: { versions: true } });
    if (!draft) throw new NotFoundException();
    const current = draft.versions.find((item) => item.version === draft.version);
    if (!current) throw new Error('Draft version missing');
    const input = DraftInputSchema.parse(JSON.parse(current.inputJson) as unknown);
    const candidates = input.action === 'create'
      ? (await this.tickets.list(user, new Date())).filter((ticket) => ticket.status === 'open' && normalizeTitle(ticket.title) === normalizeTitle(input.title))
      : undefined;
    return DraftViewSchema.parse({ id: draft.id, version: draft.version, status: draft.status, operationId: current.operationId, input, ...(input.action === 'create' ? { priority: current.priority, candidates } : {}) });
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
}
