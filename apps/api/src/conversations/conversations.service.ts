import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CONVERSATION_MESSAGE_LIMIT,
  ConsultationDecisionViewSchema,
  ConsultationTicketViewSchema,
  ConversationFlowSchema,
  ConversationViewSchema,
  HandoffReasonSchema,
  MessageViewSchema,
} from '@nexo/contracts';
import { type ConversationFlow } from '@nexo/contracts';
import { z } from 'zod';
import { transitionTicket } from '../tickets/status-transition.js';
import type {
  ConversationView,
  HandoffReason,
  MessageView,
  UserView,
  ConsultationDecisionView,
} from '@nexo/contracts';
import { DatabaseService } from '../database/database.service.js';
import { SessionLimitReachedError } from './session-limit.js';
import { formatHandoffSummary } from './handoff-summary.js';
import { resolveContextTicketId } from './context-ticket.js';
import { resumeSupportFlow } from './conversation-flow.js';
import { toMessageView } from './message-view.js';

@Injectable()
export class ConversationsService {
  private appendQueue: Promise<void> = Promise.resolve();
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  private employee(user: UserView): void {
    if (user.role !== 'employee') throw new ForbiddenException();
  }
  async list(user: UserView): Promise<ConversationView[]> {
    this.employee(user);
    const rows = await this.database.client.conversation.findMany({
      where: { ownerId: user.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.conversationView(row));
  }
  async create(user: UserView): Promise<ConversationView> {
    this.employee(user);
    const row = await this.database.client.conversation.create({ data: { ownerId: user.id } });
    return this.conversationView(row);
  }
  async confirmResolution(
    user: UserView,
    conversationId: string,
    messageId: string,
  ): Promise<ConversationView> {
    this.employee(user);
    return this.database.client.$transaction(async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: conversationId, ownerId: user.id },
      });
      if (!conversation) throw new NotFoundException();
      if (conversation.state === 'closed' && conversation.resolvedByAgentMessageId === messageId)
        return this.conversationView(conversation);
      const latest = await tx.message.findFirst({
        where: { conversationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { decision: true },
      });
      const pending = await tx.draftProposalRun.count({
        where: { conversationId, draft: { status: 'pending' } },
      });
      if (
        pending ||
        conversation.handoffRequestedAt ||
        conversation.state !== 'agent' ||
        latest?.id !== messageId ||
        latest.role !== 'agent' ||
        latest.status !== 'completed' ||
        latest.decision?.outcome !== 'completed'
      )
        throw new ConflictException();
      const guarded = await tx.conversation.updateMany({
        where: {
          id: conversationId,
          ownerId: user.id,
          state: 'agent',
          stateVersion: conversation.stateVersion,
        },
        data: {
          state: 'closed',
          closedAt: new Date(),
          resolvedByAgentMessageId: messageId,
          stateVersion: { increment: 1 },
        },
      });
      if (guarded.count !== 1) throw new ConflictException();
      return this.conversationView(
        await tx.conversation.findUniqueOrThrow({ where: { id: conversationId } }),
      );
    });
  }
  private conversationView(row: {
    id: string;
    createdAt: Date;
    state: string;
    stateVersion: number;
    handoffReason: string | null;
    handoffSummary: string | null;
    handoffRequestedAt: Date | null;
    assignedAnalystId: string | null;
    closedAt: Date | null;
    flowJson: string;
  }): ConversationView {
    return ConversationViewSchema.parse({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      state: row.state,
      stateVersion: row.stateVersion,
      handoff:
        row.handoffReason === null || row.handoffSummary === null || row.handoffRequestedAt === null
          ? null
          : {
              reason: HandoffReasonSchema.parse(row.handoffReason),
              summary: row.handoffSummary,
              requestedAt: row.handoffRequestedAt.toISOString(),
            },
      assignedAnalystId: row.assignedAnalystId,
      closedAt: row.closedAt?.toISOString() ?? null,
      flow: this.parseFlow(row.flowJson),
    });
  }
  private parseFlow(raw: string) {
    try {
      const parsed = ConversationFlowSchema.safeParse(JSON.parse(raw) as unknown);
      if (parsed.success) return parsed.data;
    } catch {
      // Existing conversations created before flow persistence resume from idle.
    }
    return ConversationFlowSchema.parse({ mode: 'none', stage: 'idle', facts: {} });
  }
  async requestHandoff(
    user: UserView,
    conversationId: string,
    reason: HandoffReason,
    contextTicketId: string | null = null,
    confirmedDraftId?: string,
  ): Promise<ConversationView> {
    this.employee(user);
    return this.database.client.$transaction(async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: conversationId, ownerId: user.id },
      });
      if (!conversation) throw new NotFoundException();
      if (confirmedDraftId) {
        const proposal = await tx.draftProposalRun.findFirst({
          where: {
            draftId: confirmedDraftId,
            ownerId: user.id,
            conversationId,
            requiresAnalyst: true,
            draft: { status: 'committed' },
          },
        });
        if (!proposal) throw new NotFoundException();
        if (proposal.handoffCompleted) return this.conversationView(conversation);
        await tx.draftProposalRun.update({
          where: { id: proposal.id },
          data: { handoffCompleted: true },
        });
        if (conversation.state !== 'agent') return this.conversationView(conversation);
      }
      const latest = await tx.message.findFirst({
        where: { conversationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { content: true },
      });
      const active = ['open', 'waiting_for_analyst', 'in_progress'];
      const first = await tx.message.findFirst({
        where: { conversationId, role: 'employee' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { content: true },
      });
      const recent = await tx.message.findMany({
        where: { conversationId, status: 'completed' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 8,
        select: { role: true, content: true },
      });
      const openTicketCount = await tx.ticket.count({
        where: { ownerId: user.id, status: { in: active } },
      });
      let ticketId = contextTicketId;
      if (!ticketId) {
        const decided = await tx.message.findFirst({
          where: {
            conversationId,
            role: 'agent',
            status: 'completed',
            decision: { isNot: null },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { decision: { select: { ticketsJson: true } } },
        });
        ticketId = resolveContextTicketId({
          explicit: null,
          decided: this.decisionTickets(decided?.decision?.ticketsJson),
          existing: conversation.contextTicketId,
        });
      }
      const requestedAt = new Date();
      if (
        ticketId &&
        !(await tx.ticket.findFirst({
          where: { id: ticketId, ownerId: user.id },
          select: { id: true },
        }))
      )
        throw new NotFoundException();
      const updated = await tx.conversation.updateMany({
        where: {
          id: conversationId,
          ownerId: user.id,
          state: 'agent',
          stateVersion: conversation.stateVersion,
        },
        data: {
          state: 'waiting_for_analyst',
          stateVersion: { increment: 1 },
          contextTicketId: ticketId,
          flowJson: JSON.stringify(resumeSupportFlow(this.parseFlow(conversation.flowJson))),
          handoffReason: reason,
          handoffSummary: formatHandoffSummary({
            reason,
            latestMessage: latest?.content,
            openTicketCount,
            initialMessage: first?.content,
            recentMessages: recent.reverse(),
          }),
          handoffRequestedAt: requestedAt,
        },
      });
      if (updated.count !== 1) throw new ConflictException();
      if (ticketId) await transitionTicket(tx, ticketId, 'waiting_for_analyst', requestedAt);
      const persisted = await tx.conversation.findUniqueOrThrow({ where: { id: conversationId } });
      return this.conversationView(persisted);
    });
  }
  private decisionTickets(
    raw: string | null | undefined,
  ): z.infer<typeof ConsultationTicketViewSchema>[] {
    if (!raw) return [];
    try {
      const parsed = z.array(ConsultationTicketViewSchema).safeParse(JSON.parse(raw) as unknown);
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }
  async ensureOwned(user: UserView, conversationId: string): Promise<void> {
    this.employee(user);
    if (
      !(await this.database.client.conversation.findFirst({
        where: { id: conversationId, ownerId: user.id },
        select: { id: true },
      }))
    )
      throw new NotFoundException();
  }
  async messages(user: UserView, conversationId: string): Promise<MessageView[]> {
    await this.ensureOwned(user, conversationId);
    const rows = await this.database.client.message.findMany({
      where: { conversationId },
      include: { decision: true, author: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toMessageView);
  }
  async flow(user: UserView, conversationId: string): Promise<ConversationFlow> {
    await this.ensureOwned(user, conversationId);
    const conversation = await this.database.client.conversation.findUnique({
      where: { id: conversationId },
      select: { flowJson: true },
    });
    if (!conversation) throw new NotFoundException();
    return this.parseFlow(conversation.flowJson);
  }
  async selectTicketForConsultation(
    user: UserView,
    conversationId: string,
    ticketId: string,
  ): Promise<void> {
    this.employee(user);
    await this.database.client.$transaction(async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: conversationId, ownerId: user.id, state: 'agent' },
        select: { flowJson: true },
      });
      if (!conversation) throw new NotFoundException();
      const flow = this.parseFlow(conversation.flowJson);
      if (flow.mode !== 'ticket_consultation') throw new ConflictException();
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, ownerId: user.id },
        select: { id: true, title: true },
      });
      if (!ticket) throw new NotFoundException();
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          flowJson: JSON.stringify({
            ...flow,
            facts: { selectedTicketId: ticket.id, selectedTicketTitle: ticket.title },
          }),
        },
      });
    });
  }
  async pendingDrafts(user: UserView, conversationId: string): Promise<Array<{ draftId: string }>> {
    await this.ensureOwned(user, conversationId);
    const runs = await this.database.client.draftProposalRun.findMany({
      where: { ownerId: user.id, conversationId, draft: { status: 'pending' } },
      select: { draftId: true },
      orderBy: { id: 'asc' },
    });
    return runs;
  }
  async captureAgentRun(user: UserView, conversationId: string): Promise<number | null> {
    await this.ensureOwned(user, conversationId);
    const conversation = await this.database.client.conversation.findFirst({
      where: { id: conversationId, ownerId: user.id },
      select: { state: true, stateVersion: true },
    });
    if (!conversation) throw new NotFoundException();
    return conversation.state === 'agent' ? conversation.stateVersion : null;
  }
  async append(user: UserView, conversationId: string, content: string): Promise<MessageView> {
    this.employee(user);
    const operation = this.appendQueue.then(() =>
      this.database.client.$transaction(async (tx) => {
        const conversation = await tx.conversation.findFirst({
          where: { id: conversationId, ownerId: user.id },
          select: { state: true },
        });
        if (!conversation) throw new NotFoundException();
        if (conversation.state === 'closed') throw new ConflictException();
        const used = await tx.message.count({ where: { conversationId, role: 'employee' } });
        if (used >= CONVERSATION_MESSAGE_LIMIT) throw new SessionLimitReachedError(used);
        const { id, createdAt } = await tx.message.create({ data: { conversationId, content } });
        return {
          id,
          content,
          createdAt: createdAt.toISOString(),
          role: 'employee' as const,
          status: 'completed' as const,
          decision: null,
          authorName: null,
        };
      }),
    );
    this.appendQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
  async appendAgentTurn(
    user: UserView,
    conversationId: string,
    input: {
      content: string;
      status: 'completed' | 'failed';
      decision: ConsultationDecisionView;
      promptVersion: string;
      runId?: string;
      flow?: ConversationFlow;
    },
  ): Promise<MessageView> {
    await this.ensureOwned(user, conversationId);
    const decision = ConsultationDecisionViewSchema.parse(input.decision);
    if (decision.draftId !== null) {
      if (
        input.status !== 'completed' ||
        !input.runId ||
        !(await this.database.client.draftProposalRun.findFirst({
          where: { id: input.runId, draftId: decision.draftId, ownerId: user.id, conversationId },
        }))
      )
        throw new NotFoundException();
    }
    const row = await this.database.client.message.create({
      data: {
        conversationId,
        content: input.content,
        role: 'agent',
        status: input.status,
        decision: {
          create: {
            intent: decision.intent,
            action: decision.action,
            appliedRule: decision.appliedRule,
            confidence: decision.confidence,
            justification: decision.justification,
            missingFactsJson: JSON.stringify(decision.missingFacts),
            quickRepliesJson: JSON.stringify(decision.quickReplies),
            actionsJson: JSON.stringify(decision.actions),
            evidenceJson: JSON.stringify(decision.evidence),
            ticketsJson: JSON.stringify(decision.tickets),
            outcome: decision.outcome,
            errorCode: decision.errorCode,
            source: decision.source,
            promptVersion: input.promptVersion,
            draftId: decision.draftId,
          },
        },
        ...(input.flow ? { flowJson: JSON.stringify(input.flow) } : {}),
      },
    });
    return MessageViewSchema.parse({
      id: row.id,
      content: row.content,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      decision,
      authorName: null,
    });
  }
  async appendAgentTurnIfCurrent(
    user: UserView,
    conversationId: string,
    stateVersion: number,
    input: {
      content: string;
      status: 'completed' | 'failed';
      decision: ConsultationDecisionView;
      promptVersion: string;
      runId?: string;
      flow?: ConversationFlow;
    },
  ): Promise<MessageView | null> {
    await this.ensureOwned(user, conversationId);
    const decision = ConsultationDecisionViewSchema.parse(input.decision);
    return this.database.client.$transaction(async (tx) => {
      const guarded = await tx.conversation.updateMany({
        where: { id: conversationId, ownerId: user.id, state: 'agent', stateVersion },
        data: {
          stateVersion: { increment: 0 },
          ...(input.flow ? { flowJson: JSON.stringify(input.flow) } : {}),
        },
      });
      if (guarded.count !== 1) return null;
      const row = await tx.message.create({
        data: {
          conversationId,
          content: input.content,
          role: 'agent',
          status: input.status,
          decision: {
            create: {
              intent: decision.intent,
              action: decision.action,
              appliedRule: decision.appliedRule,
              confidence: decision.confidence,
              justification: decision.justification,
              missingFactsJson: JSON.stringify(decision.missingFacts),
              quickRepliesJson: JSON.stringify(decision.quickReplies),
              actionsJson: JSON.stringify(decision.actions),
              evidenceJson: JSON.stringify(decision.evidence),
              ticketsJson: JSON.stringify(decision.tickets),
              outcome: decision.outcome,
              errorCode: decision.errorCode,
              source: decision.source,
              promptVersion: input.promptVersion,
              draftId: decision.draftId,
            },
          },
        },
      });
      return MessageViewSchema.parse({
        id: row.id,
        content: row.content,
        role: row.role,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        decision,
        authorName: null,
      });
    });
  }
}
