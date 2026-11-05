import { createHash } from 'node:crypto';
import {
  ConfirmDraftInputSchema,
  DraftInputSchema,
  PrioritySchema,
  TicketEventViewSchema,
  TicketViewSchema,
  type ConfirmDraftInput,
  type TicketEventView,
  type TicketView,
  type UserView,
} from '@nexo/contracts';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { Ticket } from '../generated/prisma/client.js';
import { normalizeTitle } from './normalize-title.js';
import { findTicketCandidates } from './ticket-candidates.js';
import { allocateTicketNumber, formatTicketNumber } from './ticket-number.js';
import type { TicketStatus } from '@nexo/contracts';
import { FailureSimulator, isTransientTicketError } from './failure-simulator.js';
import { canReopen, canSupplement, canTransfer, isActiveStatus, deadline, isOverdue, type Priority } from './rules.js';
import { assertEmployee, assertAnalyst, TicketService } from './ticket-service.js';

@Injectable()
export class PrismaTicketService extends TicketService {
  private queue: Promise<void> = Promise.resolve();
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(FailureSimulator) private readonly failures: FailureSimulator,
  ) {
    super();
  }

  private async retry<T>(operation: () => Promise<{ value: T; committed?: boolean }>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        this.failures.beforeOperation();
        const outcome = await operation();
        if (outcome.committed) this.failures.afterCommit();
        return outcome.value;
      } catch (error) {
        if (!isTransientTicketError(error)) throw error;
        if (attempt === 2) throw new ServiceUnavailableException();
        await new Promise<void>((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
      }
    }
    throw new ServiceUnavailableException();
  }

  private view(ticket: Ticket, now: Date): TicketView {
    const due = deadline(ticket.slaStartedAt, ticket.priority as Priority);
    return TicketViewSchema.parse({
      id: ticket.id,
      number:
        ticket.number === null ? null : formatTicketNumber(ticket.type as 'INC' | 'REQ', ticket.number),
      ownerId: ticket.ownerId,
      title: ticket.title,
      description: ticket.description,
      type: ticket.type,
      category: ticket.category,
      priority: ticket.priority,
      impact: ticket.impact,
      status: ticket.status,
      transferRequested: ticket.transferRequested,
      createdAt: ticket.createdAt.toISOString(),
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      slaStartedAt: ticket.slaStartedAt.toISOString(),
      deadline: due.toISOString(),
      overdue: isActiveStatus(ticket.status as TicketStatus) && isOverdue(due, now),
    });
  }

  async list(user: UserView, now: Date): Promise<TicketView[]> {
    assertEmployee(user);
    return this.retry(async () => {
      const rows = await this.database.client.ticket.findMany({
        where: { ownerId: user.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      return { value: rows.map((row) => this.view(row, now)) };
    });
  }

  async get(user: UserView, id: string, now: Date): Promise<TicketView> {
    assertEmployee(user);
    return this.retry(async () => {
      const row = await this.database.client.ticket.findFirst({ where: { id, ownerId: user.id } });
      if (!row) throw new NotFoundException();
      return { value: this.view(row, now) };
    });
  }

  async history(user: UserView, id: string): Promise<TicketEventView[]> {
    await this.get(user, id, new Date());
    return this.retry(async () => {
      const events = await this.database.client.ticketEvent.findMany({
        where: { ticketId: id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      return {
        value: events.map((event) =>
          TicketEventViewSchema.parse({ ...event, createdAt: event.createdAt.toISOString() }),
        ),
      };
    });
  }

  async listForAnalyst(user: UserView, ownerId: string, now: Date): Promise<TicketView[]> {
    assertAnalyst(user);
    return this.retry(async () => {
      const rows = await this.database.client.ticket.findMany({
        where: { ownerId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      return { value: rows.map((row) => this.view(row, now)) };
    });
  }

  async confirm(
    user: UserView,
    draftId: string,
    request: ConfirmDraftInput,
    now: Date,
  ): Promise<TicketView> {
    assertEmployee(user);
    const parsed = ConfirmDraftInputSchema.safeParse(request);
    if (!parsed.success) throw new BadRequestException();
    const previous = this.queue;
    let release = (): void => undefined;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await this.retry(async () =>
        this.database.client.$transaction(async (tx) => {
          const draft = await tx.ticketDraft.findFirst({
            where: { id: draftId, ownerId: user.id },
          });
          if (!draft) throw new NotFoundException();
          const version = await tx.ticketDraftVersion.findUnique({
            where: { draftId_version: { draftId, version: parsed.data.version } },
          });
          if (!version || version.operationId !== parsed.data.operationId)
            throw new ConflictException();
          const fingerprint = createHash('sha256')
            .update(JSON.stringify([user.id, draftId, version.version, version.inputJson]))
            .digest('hex');
          const prior = await tx.ticketOperation.findUnique({
            where: { operationId: parsed.data.operationId },
          });
          if (prior) {
            if (
              prior.ownerId !== user.id ||
              prior.draftId !== draftId ||
              prior.version !== version.version ||
              prior.fingerprint !== fingerprint
            )
              throw new ConflictException();
            return {
              value: TicketViewSchema.parse(JSON.parse(prior.resultJson) as unknown),
              committed: false,
            };
          }
          const claimed = await tx.ticketDraft.updateMany({
            where: { id: draftId, ownerId: user.id, version: version.version, status: 'pending' },
            data: { status: 'committed' },
          });
          if (claimed.count !== 1) throw new ConflictException();
          const action = DraftInputSchema.parse(JSON.parse(version.inputJson) as unknown);
          let ticket: Ticket;
          let kind: 'created' | 'supplemented' | 'reopened' | 'transfer_requested';
          let content: string;
          if (action.action === 'create') {
            const normalizedTitle = normalizeTitle(action.title);
            const open = await tx.ticket.findMany({
              where: {
                ownerId: user.id,
                status: { in: ['open', 'waiting_for_analyst', 'in_progress'] },
              },
            });
            const matches = findTicketCandidates(action, open).filter(
              ({ ticket, match }) =>
                match === 'exact' || !parsed.data.dismissedCandidateIds?.includes(ticket.id),
            );
            if (matches.length)
              throw new ConflictException({
                code: 'duplicate_candidates',
                candidates: matches.map(({ ticket: match }) => this.view(match, now)),
                candidateMatches: matches.map(({ ticket: match, match: kind }) => ({
                  id: match.id,
                  match: kind,
                })),
              });
            ticket = await tx.ticket.create({
              data: {
                ownerId: user.id,
                number: await allocateTicketNumber(tx, action.type),
                title: action.title,
                normalizedTitle,
                description: action.description,
                type: action.type,
                category: action.category,
                priority: PrioritySchema.parse(version.priority),
                impact: action.impact,
                slaStartedAt: now,
                createdAt: now,
              },
            });
            kind = 'created';
            content = action.description;
          } else {
            const found = await tx.ticket.findFirst({
              where: { id: action.ticketId, ownerId: user.id },
            });
            if (!found) throw new NotFoundException();
            if (action.action === 'reopen') {
              if (
                !found.resolvedAt ||
                !canReopen(found.status as TicketStatus, found.resolvedAt, now)
              )
                throw new ConflictException();
              const active = await tx.ticket.findMany({
                where: {
                  ownerId: user.id,
                  status: { in: ['open', 'waiting_for_analyst', 'in_progress'] },
                },
              });
              const matches = findTicketCandidates(found, active).filter(
                ({ ticket: candidate, match }) =>
                  match === 'exact' || !parsed.data.dismissedCandidateIds?.includes(candidate.id),
              );
              if (matches.length)
                throw new ConflictException({
                  code: 'duplicate_candidates',
                  candidates: matches.map(({ ticket: match }) => this.view(match, now)),
                  candidateMatches: matches.map(({ ticket: match, match: kind }) => ({
                    id: match.id,
                    match: kind,
                  })),
                });
              ticket = await tx.ticket.update({
                where: { id: found.id },
                data: { status: 'open', resolvedAt: null, transferRequested: false, slaStartedAt: now },
              });
              kind = 'reopened';
              content = action.reason;
            } else if (action.action === 'supplement') {
              if (!canSupplement(found.status as TicketStatus)) throw new ConflictException();
              ticket = found;
              kind = 'supplemented';
              content = action.content;
            } else {
              if (!canTransfer(found.status as TicketStatus, found.transferRequested))
                throw new ConflictException();
              ticket = await tx.ticket.update({
                where: { id: found.id },
                data: { transferRequested: true },
              });
              kind = 'transfer_requested';
              content = action.reason;
            }
          }
          await tx.ticketEvent.create({
            data: { ticketId: ticket.id, kind, content, createdAt: now },
          });
          const result = this.view(ticket, now);
          await tx.ticketOperation.create({
            data: {
              operationId: parsed.data.operationId,
              ownerId: user.id,
              draftId,
              version: version.version,
              fingerprint,
              resultJson: JSON.stringify(result),
              createdAt: now,
            },
          });
          return { value: result, committed: true };
        }),
      );
    } finally {
      release();
    }
  }
}
