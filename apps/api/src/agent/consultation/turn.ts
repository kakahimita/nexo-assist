import { ConsultationEngineDecisionSchema } from '@nexo/contracts';
import type {
  ConsultationAction,
  ConsultationDecisionView,
  ConsultationEvidence,
  ConsultationTicketView,
  ConsultationEngineDecision,
} from '@nexo/contracts';
import {
  ConsultTicketsResultSchema,
  ProposeTicketDraftResultSchema,
  SearchKnowledgeResultSchema,
} from '../tools/consultation-tool-schemas.js';
import type { ConsultationEngineEvent } from './types.js';
import { isUnsupportedQuickReply } from './quick-replies.js';

export class ConsultationTurn {
  private text = '';
  private actions: ConsultationAction[] = [];
  private evidence: ConsultationEvidence[] = [];
  private tickets: ConsultationTicketView[] = [];
  private decision: ConsultationEngineDecision | null = null;
  private draftId: string | null = null;
  private duplicateNeedsReview = false;
  apply(event: ConsultationEngineEvent): void {
    if (event.type === 'text-delta') {
      this.text += event.text;
      return;
    }
    if (event.type === 'decision') {
      const parsed = ConsultationEngineDecisionSchema.safeParse(event.decision);
      if (!parsed.success || this.decision) throw new Error('invalid_output');
      this.decision = {
        ...parsed.data,
        quickReplies: parsed.data.quickReplies.filter((reply) => !isUnsupportedQuickReply(reply)),
      };
      return;
    }
    if (event.type !== 'tool-result' && event.type !== 'tool-error') return;
    if (this.actions.some((item) => item.id === event.toolCallId)) return;
    const parsed =
      event.type === 'tool-result' && !event.isError
        ? event.tool === 'consult-tickets'
          ? ConsultTicketsResultSchema.safeParse(event.result)
          : event.tool === 'search-knowledge'
            ? SearchKnowledgeResultSchema.safeParse(event.result)
            : ProposeTicketDraftResultSchema.safeParse(event.result)
        : null;
    const proposal =
      event.type === 'tool-result' && event.tool === 'propose-ticket-draft' && parsed?.success
        ? ProposeTicketDraftResultSchema.parse(event.result)
        : null;
    const succeeded =
      parsed?.success === true &&
      (event.tool !== 'propose-ticket-draft' || proposal?.status === 'draft');
    this.actions.push({
      id: event.toolCallId,
      tool: event.tool,
      status: succeeded ? 'succeeded' : 'failed',
      label:
        event.tool === 'consult-tickets'
          ? 'Consulta de chamados'
          : event.tool === 'search-knowledge'
            ? 'Busca na base de conhecimento'
            : 'Rascunho de chamado',
      summary: succeeded ? 'Consulta concluída.' : 'Não foi possível concluir a consulta.',
    });
    if (proposal?.status === 'duplicate_candidates') {
      this.duplicateNeedsReview = true;
      this.tickets = proposal.candidates.map(
        ({
          id,
          title,
          status,
          priority,
          category,
          createdAt,
          deadline,
          slaStartedAt,
          overdue,
        }) => ({
          id,
          title,
          status,
          priority,
          category,
          createdAt,
          deadline,
          lastUpdate: slaStartedAt,
          overdue,
        }),
      );
    }
    if (proposal?.status === 'draft' && succeeded) this.draftId = proposal.draftId;
    if (!succeeded || event.type !== 'tool-result') return;
    if (event.tool === 'consult-tickets') {
      const result = ConsultTicketsResultSchema.parse(event.result);
      this.tickets = result.tickets;
      for (const ticket of result.tickets)
        this.addEvidence({ kind: 'ticket', id: ticket.id, title: ticket.title });
    } else if (event.tool === 'search-knowledge') {
      const result = SearchKnowledgeResultSchema.parse(event.result);
      for (const article of result.matches.filter((item) => item.applicability === 'applicable'))
        this.addEvidence({ kind: 'article', id: article.id, title: article.title });
    }
  }
  private addEvidence(item: ConsultationEvidence): void {
    if (!this.evidence.some((existing) => existing.kind === item.kind && existing.id === item.id))
      this.evidence.push(item);
  }
  partial() {
    return {
      text: this.text,
      actions: [...this.actions],
      evidence: [...this.evidence],
      tickets: [...this.tickets],
      draftId: this.draftId,
    };
  }
  snapshot(): {
    text: string;
    actions: ConsultationAction[];
    evidence: ConsultationEvidence[];
    tickets: ConsultationTicketView[];
    decision: ConsultationEngineDecision;
    draftId: string | null;
  } {
    if (!this.decision) throw new Error('invalid_output');
    const decision = this.duplicateNeedsReview
      ? {
          ...this.decision,
          quickReplies: this.decision.quickReplies.filter(
            (reply) => !/\b(?:criar|abrir|novo|nova)\b/i.test(reply),
          ),
        }
      : this.decision;
    return {
      text: this.text,
      actions: [...this.actions],
      evidence: [...this.evidence],
      tickets: [...this.tickets],
      decision,
      draftId: this.draftId,
    };
  }
}
export type CompletedConsultationDecision = ConsultationDecisionView;
