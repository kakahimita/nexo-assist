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
  ConversationViewSchema,
  HandoffReasonSchema,
  MessageViewSchema,
} from '@nexo/contracts';
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
  private conversationView(row: {
    id: string;
    createdAt: Date;
    state: string;
    stateVersion: number;
    handoffReason: string | null;
    handoffSummary: string | null;
    handoffRequestedAt: Date | null;
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
    });
  }
  async requestHandoff(
    user: UserView,
    conversationId: string,
    reason: HandoffReason,
  ): Promise<ConversationView> {
    this.employee(user);
    return this.database.client.$transaction(async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: conversationId, ownerId: user.id },
      });
      if (!conversation) throw new NotFoundException();
      const latest = await tx.message.findFirst({
        where: { conversationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { content: true },
      });
      const openTicketCount = await tx.ticket.count({
        where: { ownerId: user.id, status: 'open' },
      });
      const requestedAt = new Date();
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
          handoffReason: reason,
          handoffSummary: formatHandoffSummary({
            reason,
            latestMessage: latest?.content,
            openTicketCount,
          }),
          handoffRequestedAt: requestedAt,
        },
      });
      if (updated.count !== 1) throw new ConflictException();
      const persisted = await tx.conversation.findUniqueOrThrow({ where: { id: conversationId } });
      return this.conversationView(persisted);
    });
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
      include: { decision: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(({ id, content, createdAt, role, status, decision }) =>
      MessageViewSchema.parse({
        id,
        content,
        createdAt: createdAt.toISOString(),
        role,
        status,
        decision:
          decision === null
            ? null
            : ConsultationDecisionViewSchema.parse({
                intent: decision.intent,
                action: decision.action,
                appliedRule: decision.appliedRule,
                confidence: decision.confidence,
                justification: decision.justification,
                missingFacts: JSON.parse(decision.missingFactsJson),
                quickReplies: JSON.parse(decision.quickRepliesJson),
                actions: JSON.parse(decision.actionsJson),
                evidence: JSON.parse(decision.evidenceJson),
                tickets: JSON.parse(decision.ticketsJson),
                outcome: decision.outcome,
                errorCode: decision.errorCode,
                source: decision.source,
                draftId: decision.draftId,
              }),
      }),
    );
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
        if (
          !(await tx.conversation.findFirst({
            where: { id: conversationId, ownerId: user.id },
            select: { id: true },
          }))
        )
          throw new NotFoundException();
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
      },
    });
    return MessageViewSchema.parse({
      id: row.id,
      content: row.content,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      decision,
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
    },
  ): Promise<MessageView | null> {
    await this.ensureOwned(user, conversationId);
    const decision = ConsultationDecisionViewSchema.parse(input.decision);
    return this.database.client.$transaction(async (tx) => {
      const guarded = await tx.conversation.updateMany({
        where: { id: conversationId, ownerId: user.id, state: 'agent', stateVersion },
        data: { stateVersion: { increment: 0 } },
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
      });
    });
  }
}
