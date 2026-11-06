import type {
  ConsultationEngineDecision,
  ConversationFlow,
  HandoffReason,
  UserView,
} from '@nexo/contracts';

export type ConsultationToolName = import('@nexo/contracts').ConsultationToolName;

export type ConsultationRequest = {
  user: UserView;
  messages: Array<{ role: 'employee' | 'agent'; content: string }>;
  signal: AbortSignal;
  now: Date;
  conversationId?: string;
  runId?: string;
  flow?: ConversationFlow;
  modelApiKey?: string;
};

export type ConsultationEngineEvent =
  | { type: 'text-delta'; text: string }
  | {
      type: 'tool-result';
      toolCallId: string;
      tool: ConsultationToolName;
      result: unknown;
      isError?: boolean;
    }
  | { type: 'tool-error'; toolCallId: string; tool: ConsultationToolName; code: string }
  | { type: 'decision'; decision: ConsultationEngineDecision }
  | { type: 'flow'; flow: ConversationFlow }
  | { type: 'handoff'; reason: HandoffReason }
  | { type: 'finish'; usage?: unknown };

export interface ConsultationEngine {
  source: 'live' | 'deterministic';
  promptVersion: string;
  run(request: ConsultationRequest): AsyncIterable<ConsultationEngineEvent>;
}

export const CONSULTATION_PROMPT_VERSION = 'consultation-v7';
