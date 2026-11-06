import {
  EmptyConversationFlow,
  ticketStatusLabel,
  type ConsultationEngineDecision,
} from '@nexo/contracts';
import type { ConsultationTools } from '../tools/consultation-tools.js';
import { explicitFacts } from '../tools/explicit-facts.js';
import { transitionConversationFlow } from '../../conversations/conversation-flow.js';
import { fixtureMonitorResolution } from './fixture-resolution.js';
import {
  CONSULTATION_PROMPT_VERSION,
  type ConsultationEngine,
  type ConsultationEngineEvent,
} from './types.js';

export function createFixtureConsultation(tools: ConsultationTools): ConsultationEngine {
  return {
    source: 'deterministic',
    promptVersion: CONSULTATION_PROMPT_VERSION,
    async *run(request) {
      const latest = request.messages.at(-1)?.content ?? '';
      const flow = transitionConversationFlow(request.flow ?? EmptyConversationFlow, latest);
      yield { type: 'flow', flow } as ConsultationEngineEvent;
      const context = request.messages
        .filter((message) => message.role === 'employee')
        .map((message) => message.content)
        .join(' ');
      const normalized = context
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
      const recent = latest
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
      let openingIndex = -1;
      let changeIndex = -1;
      for (let i = 0; i < request.messages.length; i++) {
        const message = request.messages[i];
        if (
          message?.role === 'employee' &&
          /^(?:(?:quero|preciso) )?(?:abrir|criar|novo) (?:um )?chamado\b/i.test(message.content)
        )
          openingIndex = i;
        if (
          message?.role === 'employee' &&
          /^(?:complementar|reabrir) chamado\s*:/i.test(message.content)
        )
          changeIndex = i;
      }
      const opening = openingIndex >= 0 ? request.messages[openingIndex]?.content : undefined;
      const alreadyProposed = request.messages
        .slice(openingIndex + 1)
        .some(
          (message) => message.role === 'agent' && message.content.startsWith('Confira o rascunho'),
        );
      let changeCommand = changeIndex >= 0 ? request.messages[changeIndex]?.content : undefined;
      for (let i = openingIndex + 1; i < request.messages.length - 1; i++) {
        const previous = request.messages[i];
        const selection = request.messages[i + 1];
        if (
          i + 1 > changeIndex &&
          previous?.role === 'agent' &&
          previous.content.startsWith('Encontrei chamados que podem tratar do mesmo problema.') &&
          selection?.role === 'employee' &&
          !/^s[aã]o outros problemas[.!?]*$/i.test(selection.content.trim())
        ) {
          changeIndex = i + 1;
          changeCommand = `Complementar chamado: ${selection.content}`;
        }
      }
      const changeFinished = request.messages
        .slice(changeIndex + 1)
        .some(
          (message) => message.role === 'agent' && message.content.startsWith('Confira o rascunho'),
        );
      let text = '';
      let decision: ConsultationEngineDecision;
      if (flow.mode === 'ticket_consultation') {
        const selectedTicketId = flow.facts.selectedTicketId;
        const result = await tools.consultTickets(
          request.user,
          selectedTicketId ? { query: selectedTicketId, kind: 'reference' } : {},
          request.now,
        );
        yield {
          type: 'tool-result',
          toolCallId: 'tickets',
          tool: 'consult-tickets',
          result,
        } as ConsultationEngineEvent;
        const selected = result.match === 'one' ? result.tickets[0] : undefined;
        if (selected?.overdue) {
          yield { type: 'handoff', reason: 'overdue_ticket' };
          return;
        }
        text = selected
          ? `${selected.title}: ${ticketStatusLabel(selected.status).toLowerCase()}. Prazo: ${selected.deadline}.`
          : 'Você tem chamados abertos. Sobre qual deles quer saber?';
        decision = {
          intent: 'Consulta de chamado',
          action: selected ? 'answer' : 'clarify',
          appliedRule: 'Somente chamados do funcionário',
          confidence: 1,
          justification: selected
            ? 'Chamado selecionado pela pessoa.'
            : 'A pessoa pediu uma consulta de chamados.',
          missingFacts: selected ? [] : ['chamado'],
          quickReplies: [],
        };
      } else if (
        /\b(rh|ferias|financeiro|reembolso|instalacoes|facilities|predial|limpeza)\b/.test(recent)
      ) {
        text =
          'Posso ajudar apenas com assuntos de TI. Procure a área responsável pela sua solicitação.';
        decision = {
          intent: 'Assunto fora de TI',
          action: 'redirect',
          appliedRule: 'Escopo de TI',
          confidence: 1,
          justification: 'A solicitação pertence a outra área.',
          missingFacts: [],
          quickReplies: [],
        };
      } else if (openingIndex < 0 && changeIndex < 0 && /monitor.*sem imagem/i.test(context)) {
        yield* fixtureMonitorResolution(tools, request);
        return;
      } else if (changeCommand && changeIndex > openingIndex && !changeFinished) {
        const match = /^(complementar|reabrir) chamado\s*:\s*(.+)$/i.exec(changeCommand);
        const isSupplement = match?.[1]?.toLowerCase() === 'complementar';
        const query = match?.[2]?.trim() ?? '';
        const candidates = await tools.consultTickets(
          request.user,
          { query, kind: 'topic' },
          request.now,
        );
        yield {
          type: 'tool-result',
          toolCallId: 'tickets',
          tool: 'consult-tickets',
          result: candidates,
        };
        const selected = candidates.match === 'one' ? candidates.tickets[0] : undefined;
        const answer = request.messages
          .slice(changeIndex + 1)
          .find((message) => message.role === 'employee')
          ?.content.trim();
        if (!selected) {
          text =
            'Não encontrei um único chamado. Informe o título ou selecione um dos seus chamados.';
          decision = {
            intent: 'Alteração de chamado',
            action: 'clarify',
            appliedRule: 'Somente chamados do funcionário',
            confidence: 1,
            justification: 'É necessário identificar o chamado.',
            missingFacts: ['chamado'],
            quickReplies: [],
          };
        } else if (!answer) {
          text = isSupplement
            ? 'Quais informações deseja adicionar?'
            : 'Qual o motivo da reabertura?';
          decision = {
            intent: 'Alteração de chamado',
            action: 'clarify',
            appliedRule: 'Dados obrigatórios',
            confidence: 1,
            justification: 'Falta o conteúdo da alteração.',
            missingFacts: [isSupplement ? 'informações adicionais' : 'motivo'],
            quickReplies: [],
          };
        } else if (request.conversationId && request.runId) {
          const input = isSupplement
            ? { action: 'supplement' as const, ticketId: selected.id, content: answer }
            : { action: 'reopen' as const, ticketId: selected.id, reason: answer };
          const result = await tools.proposeDraft(request.user, input, {
            conversationId: request.conversationId,
            runId: request.runId,
            now: request.now,
          });
          yield { type: 'tool-result', toolCallId: 'draft', tool: 'propose-ticket-draft', result };
          text =
            result.status === 'draft'
              ? 'Confira o rascunho antes de confirmar.'
              : result.status === 'duplicate_candidates'
                ? 'Há chamados abertos que podem tratar do mesmo problema. Selecione um para verificar.'
                : result.status === 'reopen_not_allowed'
                  ? 'O chamado não pode ser reaberto porque o prazo de sete dias terminou.'
                  : 'Não foi possível preparar o rascunho. Confira a situação do chamado.';
          decision = {
            intent: 'Alteração de chamado',
            action: result.status === 'draft' ? 'answer' : 'clarify',
            appliedRule: 'Revisão antes da confirmação',
            confidence: 1,
            justification: 'Resultado da ferramenta de rascunho.',
            missingFacts: [],
            quickReplies: [],
          };
        } else throw new Error('invalid_output');
      } else if (opening && !alreadyProposed && openingIndex > changeIndex) {
        const employeeMessages = request.messages
          .slice(openingIndex)
          .filter((message) => message.role === 'employee')
          .map((message) => message.content);
        const facts = explicitFacts(employeeMessages);
        let question = '';
        let missing = '';
        let replies: string[] = [];
        if (!facts.impact) {
          question = 'Quem está sendo afetado?';
          missing = 'impacto';
          replies = ['Somente eu', 'Minha equipe', 'Toda a empresa'];
        } else if (!facts.workState) {
          question = 'Como o problema afeta seu trabalho?';
          missing = 'situação do trabalho';
          replies = [
            'Não consigo trabalhar',
            'Consigo trabalhar com alternativa',
            'Pedido ou melhoria',
          ];
        } else if (!facts.urgency) {
          question = 'Há compromisso em risco hoje?';
          missing = 'urgência';
          replies = ['Compromisso em risco hoje', 'Sem compromisso em risco hoje'];
        }
        const initialTitle = opening
          .replace(/^(?:(?:quero|preciso) )?(?:abrir|criar|novo) (?:um )?chamado\s*:?\s*/i, '')
          .trim();
        let title = initialTitle;
        const meaningful = (value: string) =>
          /notebook|computador|monitor|impressora|projetor|vpn|rede|wifi|senha|acesso|email|e-mail|software|aplicativo/i.test(
            value,
          );
        if (!meaningful(title)) {
          for (const message of employeeMessages.slice(1))
            if (meaningful(message)) title = message.trim();
        }
        const issue = title
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLowerCase();
        const type = /nao liga|nao funciona|parou|falha|erro|travou|lento|devagar|bloquead/.test(
          issue,
        )
          ? ('INC' as const)
          : /preciso|solicito|acesso|pedido/.test(issue)
            ? ('REQ' as const)
            : null;
        const category = /notebook|computador|monitor|impressora|projetor/.test(issue)
          ? ('hardware' as const)
          : /vpn|rede|wifi/.test(issue)
            ? ('network_vpn' as const)
            : /senha|acesso/.test(issue)
              ? ('access' as const)
              : /email|e-mail/.test(issue)
                ? ('email' as const)
                : /software|aplicativo/.test(issue)
                  ? ('software' as const)
                  : null;
        if (!question && (!title || !type || !category)) {
          question = 'Descreva o equipamento ou serviço e o problema ou pedido.';
          missing = 'descrição';
        }
        if (question) {
          text = question;
          decision = {
            intent: 'Abertura de chamado',
            action: 'clarify',
            appliedRule: 'Dados obrigatórios',
            confidence: 1,
            justification: 'Falta informação para o rascunho.',
            missingFacts: [missing],
            quickReplies: replies,
          };
        } else if (
          request.conversationId &&
          request.runId &&
          facts.impact &&
          facts.workState &&
          facts.urgency &&
          type &&
          category
        ) {
          const result = await tools.proposeDraft(
            request.user,
            { action: 'create', title: title.slice(0, 200), description: title },
            { conversationId: request.conversationId, runId: request.runId, now: request.now },
          );
          yield { type: 'tool-result', toolCallId: 'draft', tool: 'propose-ticket-draft', result };
          if (result.status === 'critical_requires_handoff') {
            yield { type: 'handoff', reason: 'critical_incident' };
            return;
          }
          text =
            result.status === 'draft'
              ? 'Confira o rascunho antes de confirmar.'
              : result.status === 'duplicate_candidates'
                ? 'Encontrei chamados que podem tratar do mesmo problema. Selecione um para verificar.'
                : 'Não foi possível preparar o rascunho. Confira os dados.';
          decision = {
            intent: 'Abertura de chamado',
            action: result.status === 'draft' ? 'answer' : 'clarify',
            appliedRule: 'Revisão antes da confirmação',
            confidence: 1,
            justification: 'Resultado da ferramenta de rascunho.',
            missingFacts: [],
            quickReplies:
              result.status === 'duplicate_candidates' &&
              result.candidateMatches.every((match) => match.match === 'possible')
                ? ['São outros problemas']
                : [],
          };
        } else throw new Error('invalid_output');
      } else if (
        (/vpn/.test(recent) && /809/.test(recent)) ||
        (/\b(?:windows|win)\s*(?:10|11)\b/.test(recent) &&
          /vpn/.test(normalized) &&
          /809/.test(normalized))
      ) {
        const platformText = /(?:windows|win)\s*(?:10|11)/.test(recent) ? recent : normalized;
        const platform = /(?:windows|win)\s*11/.test(platformText)
          ? 'Windows 11'
          : /(?:windows|win)\s*10/.test(platformText)
            ? 'Windows 10'
            : undefined;
        const tickets = await tools.consultTickets(
          request.user,
          { query: 'VPN', kind: 'topic' },
          request.now,
        );
        yield {
          type: 'tool-result',
          toolCallId: 'tickets',
          tool: 'consult-tickets',
          result: tickets,
        } as ConsultationEngineEvent;
        const knowledge = await tools.searchKnowledge(request.user, {
          query: 'VPN erro 809',
          ...(platform ? { platform } : {}),
        });
        yield {
          type: 'tool-result',
          toolCallId: 'knowledge',
          tool: 'search-knowledge',
          result: knowledge,
        } as ConsultationEngineEvent;
        const article = knowledge.matches.find((item) => item.applicability === 'applicable');
        text = article ? `${article.title}: ${article.body}` : 'Qual versão do Windows?';
        decision = {
          intent: 'Falha de VPN',
          action: article ? 'answer' : 'clarify',
          appliedRule: 'Compatibilidade com a versão do Windows',
          confidence: article ? 0.9 : 0.5,
          justification: article
            ? 'Artigo compatível encontrado.'
            : 'A versão do Windows é necessária.',
          missingFacts: article ? [] : ['versão do Windows'],
          quickReplies: article ? [] : ['Windows 10', 'Windows 11'],
        };
      } else if (/\bvpn\b/.test(recent)) {
        text =
          'Qual versão do Windows e qual mensagem ou código de erro aparece ao conectar à VPN?';
        decision = {
          intent: 'Falha de VPN',
          action: 'clarify',
          appliedRule: 'Compatibilidade com a versão do Windows',
          confidence: 0.5,
          justification: 'A versão do Windows e a mensagem de erro são necessárias.',
          missingFacts: ['versão do Windows', 'mensagem de erro'],
          quickReplies: ['Windows 10', 'Windows 11'],
        };
      } else if (
        !flow.facts.subject &&
        !/\b(?:status|andamento|prazo|situacao|situação|consult(?:a|ar)?|acompanhar)\b/.test(
          recent,
        ) &&
        !/\b(?:INC|REQ)-[\w-]+\b/i.test(latest)
      ) {
        text =
          'Descreva o equipamento ou serviço e o que acontece. Para consultar um chamado, informe o número ou pergunte pelo status.';
        decision = {
          intent: 'Solicitação de TI',
          action: 'clarify',
          appliedRule: 'Identificação da necessidade',
          confidence: 0.5,
          justification: 'Não há uma solicitação explícita de consulta de chamado.',
          missingFacts: ['descrição'],
          quickReplies: [],
        };
      } else {
        const reference = latest.match(/\b(?:INC|REQ)-[\w-]+\b/i)?.[0];
        const title = /notebook lento/i.test(latest)
          ? 'Notebook lento'
          : /senha bloqueada/i.test(latest)
            ? 'Senha bloqueada'
            : undefined;
        const input = reference
          ? { query: reference, kind: 'reference' as const }
          : title
            ? { query: title, kind: 'topic' as const }
            : {};
        const result = await tools.consultTickets(request.user, input, request.now);
        yield {
          type: 'tool-result',
          toolCallId: 'tickets',
          tool: 'consult-tickets',
          result,
        } as ConsultationEngineEvent;
        const selected = result.match === 'one' ? result.tickets[0] : undefined;
        if (selected?.overdue) {
          yield { type: 'handoff', reason: 'overdue_ticket' };
          return;
        }
        text = selected
          ? `${selected.title}: ${ticketStatusLabel(selected.status).toLowerCase()}. Prazo: ${selected.deadline}. ${selected.overdue ? 'O prazo está vencido.' : 'O prazo não está vencido.'}`
          : 'Qual chamado você deseja consultar? Selecione uma das opções.';
        decision = {
          intent: 'Consulta de chamado',
          action: selected ? 'answer' : 'clarify',
          appliedRule: 'Somente chamados do funcionário',
          confidence: selected ? 0.9 : 0.5,
          justification: selected ? 'Chamado identificado.' : 'É necessário selecionar um chamado.',
          missingFacts: selected ? [] : ['chamado'],
          quickReplies: [],
        };
      }
      if (request.signal.aborted) throw new Error('interrupted');
      const split = Math.ceil(text.length / 2);
      yield { type: 'text-delta', text: text.slice(0, split) };
      yield { type: 'text-delta', text: text.slice(split) };
      yield { type: 'decision', decision };
      yield { type: 'finish' };
    },
  };
}
