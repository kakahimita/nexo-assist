import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HandoffReasonSchema,
  SupportConversationSummarySchema,
  SupportConversationViewSchema,
  type MessageView,
  type SupportCloseInput,
  type SupportConversationFilter,
  type SupportConversationSummary,
  type SupportConversationView,
  type UserView,
} from '@nexo/contracts';
import { toMessageView } from '../conversations/message-view.js';
import { DatabaseService } from '../database/database.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { assertAnalyst, TicketService } from '../tickets/ticket-service.js';
import { isActiveStatus } from '../tickets/rules.js';
import { transitionTicket } from '../tickets/status-transition.js';
import type { TicketStatus } from '@nexo/contracts';

@Injectable()
export class HumanSupportService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(TicketService) private readonly tickets: TicketService,
  ) {}

  async queue(
    user: UserView,
    filter: SupportConversationFilter,
  ): Promise<SupportConversationSummary[]> {
    assertAnalyst(user);
    const rows = await this.database.client.conversation.findMany({
      where: this.queueWhere(filter, user.id),
      include: {
        owner: { select: { id: true, name: true } },
        messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.summary(row));
  }

  async detail(user: UserView, conversationId: string): Promise<SupportConversationView> {
    assertAnalyst(user);
    const conversation = await this.database.client.conversation.findFirst({
      where: { id: conversationId, state: { in: ['waiting_for_analyst', 'with_analyst'] } },
      include: {
        owner: { select: { id: true, name: true } },
        messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
      },
    });
    if (!conversation) throw new NotFoundException();
    const messages = await this.database.client.message.findMany({
      where: { conversationId },
      include: { decision: true, author: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const tickets = await this.tickets.listForAnalyst(user, conversation.ownerId, new Date());
    return SupportConversationViewSchema.parse({
      conversation: this.summary(conversation),
      messages: messages.map(toMessageView),
      tickets,
    });
  }

  async claim(user: UserView, conversationId: string): Promise<SupportConversationSummary> {
    assertAnalyst(user);
    await this.database.client.$transaction(async (tx) => {
      const updated = await tx.conversation.updateMany({
        where: { id: conversationId, state: 'waiting_for_analyst' },
        data: { state: 'with_analyst', assignedAnalystId: user.id, stateVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException();
      const conversation = await tx.conversation.findUniqueOrThrow({
        where: { id: conversationId },
        select: { contextTicketId: true },
      });
      if (conversation.contextTicketId)
        await transitionTicket(tx, conversation.contextTicketId, 'in_progress', new Date());
    });
    return this.loadSummary(conversationId);
  }

  async reply(user: UserView, conversationId: string, content: string): Promise<MessageView> {
    assertAnalyst(user);
    return this.database.client.$transaction(async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: conversationId },
        select: { state: true, assignedAnalystId: true },
      });
      if (!conversation) throw new NotFoundException();
      if (conversation.state !== 'with_analyst' || conversation.assignedAnalystId !== user.id)
        throw new ForbiddenException();
      const row = await tx.message.create({
        data: { conversationId, content, role: 'analyst', status: 'completed', authorId: user.id },
      });
      return toMessageView({
        id: row.id,
        content: row.content,
        createdAt: row.createdAt,
        role: row.role,
        status: row.status,
        decision: null,
        author: { name: user.name },
      });
    });
  }

  async returnToAgent(user: UserView, conversationId: string): Promise<SupportConversationSummary> {
    assertAnalyst(user);
    await this.assertOwned(user, conversationId);
    const updated = await this.database.client.conversation.updateMany({
      where: { id: conversationId, state: 'with_analyst', assignedAnalystId: user.id },
      data: { state: 'agent', assignedAnalystId: null, stateVersion: { increment: 1 } },
    });
    if (updated.count !== 1) throw new ConflictException();
    return this.loadSummary(conversationId);
  }

  async close(
    user: UserView,
    conversationId: string,
    input: SupportCloseInput,
  ): Promise<SupportConversationSummary> {
    assertAnalyst(user);
    await this.assertOwned(user, conversationId);
    await this.database.client.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUniqueOrThrow({
        where: { id: conversationId },
        select: { contextTicketId: true },
      });
      const ticket = conversation.contextTicketId
        ? await tx.ticket.findUnique({
            where: { id: conversation.contextTicketId },
            select: { id: true, type: true, status: true },
          })
        : null;
      let next: TicketStatus | null = null;
      if (ticket && isActiveStatus(ticket.status as TicketStatus)) {
        if (ticket.type === 'REQ') {
          if (!input.outcome) throw new BadRequestException();
          next = input.outcome;
        } else {
          if (input.outcome) throw new BadRequestException();
          next = 'resolved';
        }
      }
      const updated = await tx.conversation.updateMany({
        where: { id: conversationId, state: 'with_analyst', assignedAnalystId: user.id },
        data: { state: 'closed', closedAt: new Date(), stateVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException();
      if (ticket && next) await transitionTicket(tx, ticket.id, next, new Date());
    });
    return this.loadSummary(conversationId);
  }

  private async assertOwned(user: UserView, conversationId: string): Promise<void> {
    const conversation = await this.database.client.conversation.findFirst({
      where: { id: conversationId },
      select: { state: true, assignedAnalystId: true },
    });
    if (!conversation) throw new NotFoundException();
    if (conversation.state !== 'with_analyst' || conversation.assignedAnalystId !== user.id)
      throw new ForbiddenException();
  }

  private async loadSummary(conversationId: string): Promise<SupportConversationSummary> {
    const row = await this.database.client.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        owner: { select: { id: true, name: true } },
        messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
      },
    });
    return this.summary(row);
  }

  private queueWhere(
    filter: SupportConversationFilter,
    analystId: string,
  ): Prisma.ConversationWhereInput {
    if (filter === 'waiting') return { state: 'waiting_for_analyst' };
    if (filter === 'owned') return { state: 'with_analyst', assignedAnalystId: analystId };
    return { state: { in: ['waiting_for_analyst', 'with_analyst'] } };
  }

  private summary(row: {
    id: string;
    state: string;
    stateVersion: number;
    handoffReason: string | null;
    handoffSummary: string | null;
    handoffRequestedAt: Date | null;
    assignedAnalystId: string | null;
    contextTicketId: string | null;
    closedAt: Date | null;
    owner: { id: string; name: string };
    messages: Array<{ content: string; role: string; createdAt: Date }>;
  }): SupportConversationSummary {
    const latest = row.messages[0];
    return SupportConversationSummarySchema.parse({
      id: row.id,
      state: row.state,
      stateVersion: row.stateVersion,
      employee: { id: row.owner.id, name: row.owner.name },
      handoff:
        row.handoffReason === null || row.handoffSummary === null || row.handoffRequestedAt === null
          ? null
          : {
              reason: HandoffReasonSchema.parse(row.handoffReason),
              summary: row.handoffSummary,
              requestedAt: row.handoffRequestedAt.toISOString(),
            },
      assignedAnalystId: row.assignedAnalystId,
      contextTicketId: row.contextTicketId,
      closedAt: row.closedAt?.toISOString() ?? null,
      lastMessage: latest
        ? { content: latest.content, role: latest.role, createdAt: latest.createdAt.toISOString() }
        : null,
    });
  }
}
