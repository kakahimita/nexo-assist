import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  HandoffReasonSchema,
  SupportConversationSummarySchema,
  SupportConversationViewSchema,
  type SupportConversationFilter,
  type SupportConversationSummary,
  type SupportConversationView,
  type UserView,
} from '@nexo/contracts';
import { toMessageView } from '../conversations/message-view.js';
import { DatabaseService } from '../database/database.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { assertAnalyst, TicketService } from '../tickets/ticket-service.js';

@Injectable()
export class HumanSupportService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(TicketService) private readonly tickets: TicketService,
  ) {}

  async queue(user: UserView, filter: SupportConversationFilter): Promise<SupportConversationSummary[]> {
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

  private queueWhere(filter: SupportConversationFilter, analystId: string): Prisma.ConversationWhereInput {
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
      lastMessage: latest
        ? { content: latest.content, role: latest.role, createdAt: latest.createdAt.toISOString() }
        : null,
    });
  }
}
