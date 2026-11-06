import type { ConsultationTools } from '../tools/consultation-tools.js';
import { createConsultationTools } from '../tools/mastra-consultation-tools.js';
import { ProposeTicketDraftResultSchema } from '../tools/consultation-tool-schemas.js';
import { createConsultationRequestContext } from './request-context.js';
import type { ConsultationRequest } from './types.js';

// A single declared CI scenario supplies prewritten semantic facts. This verifies
// the actual live-tool adapter and browser wiring, not natural-language inference.
export const NATURAL_SUPPORT_REPORT =
  'Meu monitor panorâmico está sem imagem e só acontece comigo. Posso usar outra estação e não tenho compromisso em risco hoje.';
export async function fixtureNaturalProposal(
  tools: ConsultationTools,
  request: ConsultationRequest,
) {
  const employee = request.messages.filter((message) => message.role === 'employee');
  const report = employee.find((message) => message.content === NATURAL_SUPPORT_REPORT);
  if (!report?.id || !request.conversationId || !request.runId) throw new Error('invalid_output');
  const messageId = report.id;
  const fact = <T extends string>(value: T, quote: string) => ({
    value,
    evidence: { messageId, quote },
  });
  const wrapper = createConsultationTools(tools).proposeDraft;
  const result = await wrapper.execute!(
    {
      action: 'create',
      title: 'Meu monitor panorâmico está sem imagem',
      description: employee.map((message) => message.content).join('\n'),
      requiresAnalyst: true,
      interpretation: {
        requestStartMessageId: report.id,
        type: fact('INC', 'Meu monitor panorâmico está sem imagem'),
        category: fact('hardware', 'Meu monitor panorâmico está sem imagem'),
        impact: fact('self', 'só acontece comigo'),
        workState: fact('workaround', 'Posso usar outra estação'),
        urgency: fact('normal', 'não tenho compromisso em risco hoje'),
      },
    },
    {
      requestContext: createConsultationRequestContext(
        request.user,
        request.now,
        request.conversationId,
        request.runId,
        employee.flatMap((message) => (message.id ? [message.id] : [])),
      ),
    } as never,
  );
  return ProposeTicketDraftResultSchema.parse(result);
}
