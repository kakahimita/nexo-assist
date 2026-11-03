import {
  ConsultationDecisionViewSchema,
  MessageViewSchema,
  type MessageView,
} from '@nexo/contracts';

export interface MessageDecisionRow {
  intent: string;
  action: string;
  appliedRule: string;
  confidence: number;
  justification: string;
  missingFactsJson: string;
  quickRepliesJson: string;
  actionsJson: string;
  evidenceJson: string;
  ticketsJson: string;
  outcome: string;
  errorCode: string | null;
  source: string;
  draftId: string | null;
}

export interface MessageRow {
  id: string;
  content: string;
  createdAt: Date;
  role: string;
  status: string;
  decision: MessageDecisionRow | null;
  author: { name: string } | null;
}

export function toMessageView(row: MessageRow): MessageView {
  return MessageViewSchema.parse({
    id: row.id,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    role: row.role,
    status: row.status,
    decision:
      row.decision === null
        ? null
        : ConsultationDecisionViewSchema.parse({
            intent: row.decision.intent,
            action: row.decision.action,
            appliedRule: row.decision.appliedRule,
            confidence: row.decision.confidence,
            justification: row.decision.justification,
            missingFacts: JSON.parse(row.decision.missingFactsJson),
            quickReplies: JSON.parse(row.decision.quickRepliesJson),
            actions: JSON.parse(row.decision.actionsJson),
            evidence: JSON.parse(row.decision.evidenceJson),
            tickets: JSON.parse(row.decision.ticketsJson),
            outcome: row.decision.outcome,
            errorCode: row.decision.errorCode,
            source: row.decision.source,
            draftId: row.decision.draftId,
          }),
    authorName: row.author?.name ?? null,
  });
}
