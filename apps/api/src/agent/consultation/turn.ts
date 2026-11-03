import { ConsultationEngineDecisionSchema } from '@nexo/contracts';
import type { ConsultationAction, ConsultationDecisionView, ConsultationEvidence, ConsultationTicketView, ConsultationEngineDecision } from '@nexo/contracts';
import { ConsultTicketsResultSchema, SearchKnowledgeResultSchema } from '../tools/consultation-tool-schemas.js';
import type { ConsultationEngineEvent } from './types.js';

export class ConsultationTurn {
  private text = '';
  private actions: ConsultationAction[] = [];
  private evidence: ConsultationEvidence[] = [];
  private tickets: ConsultationTicketView[] = [];
  private decision: ConsultationEngineDecision | null = null;
  apply(event: ConsultationEngineEvent): void {
    if (event.type === 'text-delta') { this.text += event.text; return; }
    if (event.type === 'decision') {
      const parsed = ConsultationEngineDecisionSchema.safeParse(event.decision);
      if (!parsed.success || this.decision) throw new Error('invalid_output');
      this.decision = parsed.data; return;
    }
    if (event.type !== 'tool-result' && event.type !== 'tool-error') return;
    if (this.actions.some((item) => item.id === event.toolCallId)) return;
    const parsed = event.type === 'tool-result' && !event.isError ? (event.tool === 'consult-tickets' ? ConsultTicketsResultSchema.safeParse(event.result) : SearchKnowledgeResultSchema.safeParse(event.result)) : null;
    const succeeded = parsed?.success === true;
    this.actions.push({ id: event.toolCallId, tool: event.tool, status: succeeded ? 'succeeded' : 'failed', label: event.tool === 'consult-tickets' ? 'Consulta de chamados' : 'Busca na base de conhecimento', summary: succeeded ? 'Consulta concluída.' : 'Não foi possível concluir a consulta.' });
    if (!succeeded || event.type !== 'tool-result') return;
    if (event.tool === 'consult-tickets') {
      const result = ConsultTicketsResultSchema.parse(event.result); this.tickets = result.tickets;
      for (const ticket of result.tickets) this.addEvidence({ kind: 'ticket', id: ticket.id, title: ticket.title });
    } else {
      const result = SearchKnowledgeResultSchema.parse(event.result);
      for (const article of result.matches.filter((item) => item.applicability === 'applicable')) this.addEvidence({ kind: 'article', id: article.id, title: article.title });
    }
  }
  private addEvidence(item: ConsultationEvidence): void { if (!this.evidence.some((existing) => existing.kind === item.kind && existing.id === item.id)) this.evidence.push(item); }
  snapshot(): { text: string; actions: ConsultationAction[]; evidence: ConsultationEvidence[]; tickets: ConsultationTicketView[]; decision: ConsultationEngineDecision } {
    if (!this.decision) throw new Error('invalid_output');
    return { text: this.text, actions: [...this.actions], evidence: [...this.evidence], tickets: [...this.tickets], decision: this.decision };
  }
}
export type CompletedConsultationDecision = ConsultationDecisionView;
