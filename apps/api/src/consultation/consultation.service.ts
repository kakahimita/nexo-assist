import { Inject, Injectable } from '@nestjs/common';
import type {
  ConsultationDecisionView,
  ConsultationStreamEvent,
  ConsultationTicketView,
  MessageView,
  UserView,
} from '@nexo/contracts';
import { ConversationsService } from '../conversations/conversations.service.js';
import { restoreConversationFlow } from '../conversations/conversation-flow.js';
import { resumeSupportFlow } from '../conversations/conversation-flow.js';
import { ConsultationTurn } from '../agent/consultation/turn.js';
import type { ConsultationEngine, ConsultationEngineEvent } from '../agent/consultation/types.js';
import { ConsultTicketsResultSchema } from '../agent/tools/consultation-tool-schemas.js';
export const CONSULTATION_ENGINE = Symbol('CONSULTATION_ENGINE');
function overdueConsultedTicket(event: ConsultationEngineEvent): ConsultationTicketView | null {
  if (event.type !== 'tool-result' || event.tool !== 'consult-tickets' || event.isError)
    return null;
  const parsed = ConsultTicketsResultSchema.safeParse(event.result);
  if (!parsed.success || parsed.data.match !== 'one') return null;
  const [ticket] = parsed.data.tickets;
  return ticket?.overdue ? ticket : null;
}
type ErrorCode = 'quota' | 'model_unavailable' | 'invalid_output' | 'interrupted';
function errorCode(error: unknown, signal: AbortSignal): ErrorCode {
  if (signal.aborted) return 'interrupted';
  if (
    typeof error === 'object' &&
    error !== null &&
    (('statusCode' in error && error.statusCode === 429) ||
      ('status' in error && error.status === 429))
  )
    return 'quota';
  const message = error instanceof Error ? error.message : '';
  return message === 'quota' || message === 'invalid_output' || message === 'interrupted'
    ? message
    : 'model_unavailable';
}
function singleActiveTicket(turn: ConsultationTurn): string | null {
  const active = turn
    .partial()
    .tickets.filter((ticket) =>
      ['open', 'waiting_for_analyst', 'in_progress'].includes(ticket.status),
    );
  return active.length === 1 ? active[0]!.id : null;
}
@Injectable()
export class ConsultationService {
  constructor(
    @Inject(ConversationsService) private readonly conversations: ConversationsService,
    @Inject(CONSULTATION_ENGINE) private readonly engine: ConsultationEngine,
  ) {}
  async *run(
    user: UserView,
    conversationId: string,
    message: MessageView,
    signal: AbortSignal,
    runId: string,
    stateVersion: number,
    modelApiKey?: string,
  ): AsyncIterable<ConsultationStreamEvent> {
    yield { type: 'user-message', message };
    const turn = new ConsultationTurn();
    try {
      const history = await this.conversations.messages(user, conversationId);
      const storedFlow = await this.conversations.flow(user, conversationId);
      const flow = restoreConversationFlow(
        storedFlow,
        history.filter((item) => item.role === 'employee').map((item) => item.content),
      );
      let nextFlow = flow;
      let finished = false;
      for await (const event of this.engine.run({
        user,
        messages: history.flatMap(({ role, content }) =>
          role === 'analyst' ? [] : [{ role, content }],
        ),
        signal,
        now: new Date(),
        conversationId,
        runId,
        flow,
        ...(modelApiKey === undefined ? {} : { modelApiKey }),
      })) {
        if (signal.aborted) throw new Error('interrupted');
        if (event.type === 'handoff') {
          await this.conversations.requestHandoff(
            user,
            conversationId,
            event.reason,
            singleActiveTicket(turn),
          );
          yield { type: 'handoff-waiting' };
          return;
        }
        const before = turn.partial().actions.length;
        if (event.type === 'flow') {
          nextFlow = event.flow;
          continue;
        }
        turn.apply(event);
        const overdue = overdueConsultedTicket(event);
        if (overdue) {
          yield* this.transferOverdue(
            user,
            conversationId,
            stateVersion,
            overdue,
            turn,
            this.engine,
          );
          return;
        }
        if (event.type === 'text-delta') yield { type: 'text-delta', text: event.text };
        if (
          event.type === 'decision' &&
          event.decision.action === 'handoff' &&
          event.decision.missingFacts.length === 0
        ) {
          await this.conversations.requestHandoff(
            user,
            conversationId,
            'unresolved_uncertainty',
            singleActiveTicket(turn),
          );
          yield { type: 'handoff-waiting' };
          return;
        }
        if (event.type === 'finish') finished = true;
        const actions = turn.partial().actions;
        if (actions.length > before) yield { type: 'action', action: actions[actions.length - 1]! };
      }
      if (signal.aborted) throw new Error('interrupted');
      if (!finished) throw new Error('invalid_output');
      const snapshot = turn.snapshot();
      const visibleText = snapshot.decision.reply?.trim() || snapshot.text.trim();
      if (!visibleText) throw new Error('invalid_output');
      const decision: ConsultationDecisionView = {
        intent: snapshot.decision.intent,
        action: snapshot.decision.action,
        appliedRule: snapshot.decision.appliedRule,
        confidence: snapshot.decision.confidence,
        justification: snapshot.decision.justification,
        missingFacts: snapshot.decision.missingFacts,
        quickReplies: snapshot.decision.quickReplies,
        actions: snapshot.actions,
        evidence: snapshot.evidence,
        tickets: snapshot.tickets,
        outcome: 'completed',
        errorCode: null,
        source: this.engine.source,
        draftId: snapshot.draftId,
      };
      if (flow.mode === 'ticket_consultation' && flow.facts.selectedTicketId) {
        nextFlow = resumeSupportFlow(flow);
      }
      const final = await this.conversations.appendAgentTurnIfCurrent(
        user,
        conversationId,
        stateVersion,
        {
          content: visibleText,
          status: 'completed',
          decision,
          promptVersion: this.engine.promptVersion,
          runId,
          flow: nextFlow,
        },
      );
      if (final === null) {
        yield { type: 'handoff-waiting' };
        return;
      }
      yield { type: 'done', message: final };
    } catch (error) {
      const code = errorCode(error, signal);
      const decision: ConsultationDecisionView = {
        intent: 'Consulta indisponível',
        action: 'unavailable',
        appliedRule: 'Falha na consulta',
        confidence: 0,
        justification: 'Não foi possível concluir a consulta.',
        missingFacts: [],
        quickReplies: [],
        actions: [],
        evidence: [],
        tickets: [],
        outcome: 'failed',
        errorCode: code,
        source: this.engine.source,
        draftId: null,
      };
      const final = await this.conversations.appendAgentTurnIfCurrent(
        user,
        conversationId,
        stateVersion,
        {
          content: 'Não foi possível concluir a resposta. Tente novamente.',
          status: 'failed',
          decision,
          promptVersion: this.engine.promptVersion,
        },
      );
      if (final === null) {
        yield { type: 'handoff-waiting' };
        return;
      }
      yield { type: 'error', code };
      yield { type: 'done', message: final };
    }
  }
  private async *transferOverdue(
    user: UserView,
    conversationId: string,
    stateVersion: number,
    ticket: ConsultationTicketView,
    turn: ConsultationTurn,
    engine: ConsultationEngine,
  ): AsyncIterable<ConsultationStreamEvent> {
    const partial = turn.partial();
    const decision: ConsultationDecisionView = {
      intent: 'Consulta de chamado',
      action: 'handoff',
      appliedRule: 'Chamado vencido é transferido a um analista',
      confidence: 1,
      justification: 'O prazo do chamado consultado está vencido.',
      missingFacts: [],
      quickReplies: [],
      actions: partial.actions,
      evidence: partial.evidence,
      tickets: [{ ...ticket, status: 'waiting_for_analyst' }],
      outcome: 'completed',
      errorCode: null,
      source: engine.source,
      draftId: null,
    };
    const message = await this.conversations.appendAgentTurnIfCurrent(
      user,
      conversationId,
      stateVersion,
      {
        content: `${ticket.title} está com o prazo vencido. Transferi a conversa para um analista, com o resumo do caso. Até ele devolver a conversa, eu não respondo por aqui.`,
        status: 'completed',
        decision,
        promptVersion: engine.promptVersion,
      },
    );
    if (message === null) {
      yield { type: 'handoff-waiting' };
      return;
    }
    yield { type: 'done', message };
    await this.conversations.requestHandoff(user, conversationId, 'overdue_ticket', ticket.id);
    yield { type: 'handoff-waiting' };
  }
}
