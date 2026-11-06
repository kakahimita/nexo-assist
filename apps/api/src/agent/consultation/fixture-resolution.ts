import type { ConsultationEngineDecision } from '@nexo/contracts';
import { explicitFacts } from '../tools/explicit-facts.js';
import type { ConsultationTools } from '../tools/consultation-tools.js';
import type { ConsultationEngineEvent, ConsultationRequest } from './types.js';
import { fixtureNaturalProposal, NATURAL_SUPPORT_REPORT } from './fixture-natural-proposal.js';

// Controlled monitor scenario for CI. It does not stand in for live-model evaluation.
export async function* fixtureMonitorResolution(
  tools: ConsultationTools,
  request: ConsultationRequest,
): AsyncIterable<ConsultationEngineEvent> {
  const employee = request.messages
    .filter((message) => message.role === 'employee')
    .map((message) => message.content);
  const latest = employee.at(-1)?.trim() ?? '';
  let reply: string;
  let action: ConsultationEngineDecision['action'] = 'answer';
  let missingFacts: string[] = [];
  let quickReplies: string[] = [];
  if (/^resolveu[.!]*$/i.test(latest)) {
    reply = 'Que bom que resolveu! Não foi necessário abrir um chamado.';
  } else if (!employee.some((message) => /n[aã]o resolveu/i.test(message))) {
    const result = await tools.searchKnowledge(request.user, { query: 'monitor sem imagem' });
    yield {
      type: 'tool-result',
      tool: 'search-knowledge',
      toolCallId: 'monitor-knowledge',
      result,
    };
    const article = result.matches.find(
      (item) => item.id === 'kb-monitor-not-detected' && item.applicability === 'applicable',
    );
    if (!article) throw new Error('invalid_output');
    reply = `${article.body} Isso resolveu?`;
    quickReplies = ['Resolveu', 'Não resolveu'];
  } else {
    if (employee.includes(NATURAL_SUPPORT_REPORT)) {
      const result = await fixtureNaturalProposal(tools, request);
      yield {
        type: 'tool-result',
        toolCallId: 'natural-support-draft',
        tool: 'propose-ticket-draft',
        result,
      };
      yield {
        type: 'decision',
        decision: {
          intent: 'Suporte ao monitor',
          action: 'answer',
          appliedRule: 'Fatos semânticos com evidência',
          confidence: 1,
          justification: 'Cenário controlado, não avaliação do modelo.',
          missingFacts: [],
          quickReplies: [],
          reply:
            'Confira o rascunho. Após sua confirmação, o chamado seguirá para um atendente com o histórico.',
        },
      };
      yield { type: 'finish' };
      return;
    }
    const facts = explicitFacts(employee);
    action = 'clarify';
    if (!facts.impact) {
      reply =
        'Como a orientação não resolveu, vou preparar um chamado para o atendente. Quem está sendo afetado?';
      missingFacts = ['impacto'];
      quickReplies = ['Somente eu', 'Minha equipe', 'Toda a empresa'];
    } else if (!facts.workState) {
      reply = 'Como o problema afeta seu trabalho?';
      missingFacts = ['situação do trabalho'];
      quickReplies = [
        'Não consigo trabalhar',
        'Consigo trabalhar com alternativa',
        'Pedido ou melhoria',
      ];
    } else if (!facts.urgency) {
      reply = 'Há compromisso em risco hoje?';
      missingFacts = ['urgência'];
      quickReplies = ['Compromisso em risco hoje', 'Sem compromisso em risco hoje'];
    } else {
      if (!request.conversationId || !request.runId) throw new Error('invalid_output');
      const title = employee.find((message) => /monitor.*sem imagem/i.test(message))!;
      const result = await tools.proposeDraft(
        request.user,
        { action: 'create', title, description: title, requiresAnalyst: true },
        { conversationId: request.conversationId, runId: request.runId, now: request.now },
      );
      yield {
        type: 'tool-result',
        tool: 'propose-ticket-draft',
        toolCallId: 'monitor-draft',
        result,
      };
      if (result.status === 'critical_requires_handoff') {
        yield { type: 'handoff', reason: 'critical_incident' };
        return;
      }
      action = result.status === 'draft' ? 'answer' : 'clarify';
      reply =
        result.status === 'draft'
          ? 'Confira o rascunho. Após sua confirmação, o chamado seguirá para um atendente com o histórico.'
          : 'Encontrei chamados que podem tratar do mesmo problema. Selecione um para verificar.';
    }
  }
  yield { type: 'text-delta', text: reply };
  yield {
    type: 'decision',
    decision: {
      intent: 'Suporte ao monitor',
      action,
      appliedRule: 'Tentar resolver antes de abrir chamado',
      confidence: 1,
      justification: 'Cenário controlado de diagnóstico e continuidade humana.',
      missingFacts,
      quickReplies,
    },
  };
  yield { type: 'finish' };
}
