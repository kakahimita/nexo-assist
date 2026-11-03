import { Inject, Injectable } from '@nestjs/common';
import type { ConsultationDecisionView, ConsultationStreamEvent, MessageView, UserView } from '@nexo/contracts';
import { ConversationsService } from '../conversations/conversations.service.js';
import { ConsultationTurn } from '../agent/consultation/turn.js';
import type { ConsultationEngine } from '../agent/consultation/types.js';
export const CONSULTATION_ENGINE = Symbol('CONSULTATION_ENGINE');
type ErrorCode = 'quota' | 'model_unavailable' | 'invalid_output' | 'interrupted';
function errorCode(error: unknown, signal: AbortSignal): ErrorCode {
  if (signal.aborted) return 'interrupted';
  if (typeof error === 'object' && error !== null && (('statusCode' in error && error.statusCode === 429) || ('status' in error && error.status === 429))) return 'quota';
  const message = error instanceof Error ? error.message : '';
  return message === 'quota' || message === 'invalid_output' || message === 'interrupted' ? message : 'model_unavailable';
}
@Injectable()
export class ConsultationService {
  constructor(@Inject(ConversationsService) private readonly conversations: ConversationsService, @Inject(CONSULTATION_ENGINE) private readonly engine: ConsultationEngine) {}
  async *run(user: UserView, conversationId: string, message: MessageView, signal: AbortSignal): AsyncIterable<ConsultationStreamEvent> {
    yield { type: 'user-message', message };
    const turn = new ConsultationTurn();
    try {
      const history = await this.conversations.messages(user, conversationId);
      let finished = false;
      for await (const event of this.engine.run({ user, messages: history.map(({ role, content }) => ({ role, content })), signal, now: new Date() })) {
        if (signal.aborted) throw new Error('interrupted');
        const before = turn.partial().actions.length;
        turn.apply(event);
        if (event.type === 'text-delta') yield { type: 'text-delta', text: event.text };
        if (event.type === 'finish') finished = true;
        const actions = turn.partial().actions;
        if (actions.length > before) yield { type: 'action', action: actions[actions.length - 1]! };
      }
      if (signal.aborted) throw new Error('interrupted');
      if (!finished) throw new Error('invalid_output');
      const snapshot = turn.snapshot();
      if (!snapshot.text.trim()) throw new Error('invalid_output');
      const decision: ConsultationDecisionView = { ...snapshot.decision, actions: snapshot.actions, evidence: snapshot.evidence, tickets: snapshot.tickets, outcome: 'completed', errorCode: null, source: this.engine.source };
      const final = await this.conversations.appendAgentTurn(user, conversationId, { content: snapshot.text, status: 'completed', decision, promptVersion: this.engine.promptVersion });
      yield { type: 'done', message: final };
    } catch (error) {
      const code = errorCode(error, signal);
      const decision: ConsultationDecisionView = { intent: 'Consulta indisponível', action: 'unavailable', appliedRule: 'Falha na consulta', confidence: 0, justification: 'Não foi possível concluir a consulta.', missingFacts: [], quickReplies: [], actions: [], evidence: [], tickets: [], outcome: 'failed', errorCode: code, source: this.engine.source };
      const final = await this.conversations.appendAgentTurn(user, conversationId, { content: 'Não foi possível concluir a resposta. Tente novamente.', status: 'failed', decision, promptVersion: this.engine.promptVersion });
      yield { type: 'error', code };
      yield { type: 'done', message: final };
    }
  }
}
