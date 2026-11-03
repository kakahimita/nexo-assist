import type { ConsultationEngineDecision } from '@nexo/contracts';
import type { ConsultationTools } from '../tools/consultation-tools.js';
import { CONSULTATION_PROMPT_VERSION, type ConsultationEngine, type ConsultationEngineEvent } from './types.js';

export function createFixtureConsultation(tools: ConsultationTools): ConsultationEngine {
  return { source: 'deterministic', promptVersion: CONSULTATION_PROMPT_VERSION, async *run(request) {
    const latest = request.messages.at(-1)?.content ?? '';
    const context = request.messages.filter((message) => message.role === 'employee').map((message) => message.content).join(' ');
    const normalized = context.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const recent = latest.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    let text = ''; let decision: ConsultationEngineDecision;
    if (/\b(rh|ferias|financeiro|reembolso|instalacoes|facilities|predial|limpeza)\b/.test(recent)) {
      text = 'Posso ajudar apenas com assuntos de TI. Procure a área responsável pela sua solicitação.';
      decision = { intent: 'Assunto fora de TI', action: 'redirect', appliedRule: 'Escopo de TI', confidence: 1, justification: 'A solicitação pertence a outra área.', missingFacts: [], quickReplies: [] };
    } else if ((/vpn/.test(recent) && /809/.test(recent)) || (/\b(?:windows|win)\s*(?:10|11)\b/.test(recent) && /vpn/.test(normalized) && /809/.test(normalized))) {
      const platformText = /(?:windows|win)\s*(?:10|11)/.test(recent) ? recent : normalized;
      const platform = /(?:windows|win)\s*11/.test(platformText) ? 'Windows 11' : /(?:windows|win)\s*10/.test(platformText) ? 'Windows 10' : undefined;
      const tickets = await tools.consultTickets(request.user, { query: 'VPN', kind: 'topic' }, request.now);
      yield { type: 'tool-result', toolCallId: 'tickets', tool: 'consult-tickets', result: tickets } as ConsultationEngineEvent;
      const knowledge = await tools.searchKnowledge(request.user, { query: 'VPN erro 809', ...(platform ? { platform } : {}) });
      yield { type: 'tool-result', toolCallId: 'knowledge', tool: 'search-knowledge', result: knowledge } as ConsultationEngineEvent;
      const article = knowledge.matches.find((item) => item.applicability === 'applicable');
      text = article ? `${article.title}: ${article.body}` : 'Qual versão do Windows?';
      decision = { intent: 'Falha de VPN', action: article ? 'answer' : 'clarify', appliedRule: 'Compatibilidade com a versão do Windows', confidence: article ? 0.9 : 0.5, justification: article ? 'Artigo compatível encontrado.' : 'A versão do Windows é necessária.', missingFacts: article ? [] : ['versão do Windows'], quickReplies: article ? [] : ['Windows 10', 'Windows 11'] };
    } else {
      const reference = latest.match(/\b(?:INC|REQ)-[\w-]+\b/i)?.[0];
      const title = /notebook lento/i.test(latest) ? 'Notebook lento' : /senha bloqueada/i.test(latest) ? 'Senha bloqueada' : undefined;
      const input = reference ? { query: reference, kind: 'reference' as const } : title ? { query: title, kind: 'topic' as const } : {};
      const result = await tools.consultTickets(request.user, input, request.now);
      yield { type: 'tool-result', toolCallId: 'tickets', tool: 'consult-tickets', result } as ConsultationEngineEvent;
      const selected = result.match === 'one' ? result.tickets[0] : undefined;
      text = selected ? `${selected.title}: ${selected.status === 'open' ? 'aberto' : 'resolvido'}. Prazo: ${selected.deadline}. ${selected.overdue ? 'O prazo está vencido.' : 'O prazo não está vencido.'}` : 'Qual chamado você deseja consultar? Selecione uma das opções.';
      decision = { intent: 'Consulta de chamado', action: selected ? 'answer' : 'clarify', appliedRule: 'Somente chamados do funcionário', confidence: selected ? 0.9 : 0.5, justification: selected ? 'Chamado identificado.' : 'É necessário selecionar um chamado.', missingFacts: selected ? [] : ['chamado'], quickReplies: [] };
    }
    if (request.signal.aborted) throw new Error('interrupted');
    const split = Math.ceil(text.length / 2);
    yield { type: 'text-delta', text: text.slice(0, split) };
    yield { type: 'text-delta', text: text.slice(split) };
    yield { type: 'decision', decision };
    yield { type: 'finish' };
  } };
}
