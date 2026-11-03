import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONVERSATION_MESSAGE_LIMIT, ConsultationDecisionViewSchema, MessageViewSchema } from '@nexo/contracts';
import type { ConversationView, MessageView, UserView, ConsultationDecisionView } from '@nexo/contracts';
import { DatabaseService } from '../database/database.service.js';
import { SessionLimitReachedError } from './session-limit.js';

@Injectable()
export class ConversationsService {
  private appendQueue: Promise<void> = Promise.resolve();
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  private employee(user: UserView): void { if (user.role !== 'employee') throw new ForbiddenException(); }
  async list(user: UserView): Promise<ConversationView[]> {
    this.employee(user);
    const rows = await this.database.client.conversation.findMany({ where: { ownerId: user.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(({ id, createdAt }) => ({ id, createdAt: createdAt.toISOString() }));
  }
  async create(user: UserView): Promise<ConversationView> {
    this.employee(user);
    const row = await this.database.client.conversation.create({ data: { ownerId: user.id } });
    return { id: row.id, createdAt: row.createdAt.toISOString() };
  }
  async ensureOwned(user: UserView, conversationId: string): Promise<void> {
    this.employee(user);
    if (!await this.database.client.conversation.findFirst({ where: { id: conversationId, ownerId: user.id }, select: { id: true } })) throw new NotFoundException();
  }
  async messages(user: UserView, conversationId: string): Promise<MessageView[]> {
    await this.ensureOwned(user, conversationId);
    const rows = await this.database.client.message.findMany({ where: { conversationId }, include: { decision: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(({ id, content, createdAt, role, status, decision }) => MessageViewSchema.parse({ id, content, createdAt: createdAt.toISOString(), role, status, decision: decision === null ? null : ConsultationDecisionViewSchema.parse({ intent: decision.intent, action: decision.action, appliedRule: decision.appliedRule, confidence: decision.confidence, justification: decision.justification, missingFacts: JSON.parse(decision.missingFactsJson), quickReplies: JSON.parse(decision.quickRepliesJson), actions: JSON.parse(decision.actionsJson), evidence: JSON.parse(decision.evidenceJson), tickets: JSON.parse(decision.ticketsJson), outcome: decision.outcome, errorCode: decision.errorCode, source: decision.source }) }));
  }
  async append(user: UserView, conversationId: string, content: string): Promise<MessageView> {
    this.employee(user);
    const operation = this.appendQueue.then(() => this.database.client.$transaction(async (tx) => {
      if (!await tx.conversation.findFirst({ where: { id: conversationId, ownerId: user.id }, select: { id: true } })) throw new NotFoundException();
      const used = await tx.message.count({ where: { conversationId, role: 'employee' } });
      if (used >= CONVERSATION_MESSAGE_LIMIT) throw new SessionLimitReachedError(used);
      const { id, createdAt } = await tx.message.create({ data: { conversationId, content } });
      return { id, content, createdAt: createdAt.toISOString(), role: 'employee' as const, status: 'completed' as const, decision: null };
    }));
    this.appendQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }
  async appendAgentTurn(user: UserView, conversationId: string, input: { content: string; status: 'completed' | 'failed'; decision: ConsultationDecisionView; promptVersion: string }): Promise<MessageView> {
    await this.ensureOwned(user, conversationId);
    const decision = ConsultationDecisionViewSchema.parse(input.decision);
    const row = await this.database.client.message.create({ data: { conversationId, content: input.content, role: 'agent', status: input.status, decision: { create: {
      intent: decision.intent, action: decision.action, appliedRule: decision.appliedRule, confidence: decision.confidence, justification: decision.justification,
      missingFactsJson: JSON.stringify(decision.missingFacts), quickRepliesJson: JSON.stringify(decision.quickReplies), actionsJson: JSON.stringify(decision.actions), evidenceJson: JSON.stringify(decision.evidence), ticketsJson: JSON.stringify(decision.tickets), outcome: decision.outcome, errorCode: decision.errorCode, source: decision.source, promptVersion: input.promptVersion,
    } } } });
    return MessageViewSchema.parse({ id: row.id, content: row.content, role: row.role, status: row.status, createdAt: row.createdAt.toISOString(), decision });
  }

}
