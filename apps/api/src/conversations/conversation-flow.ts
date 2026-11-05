import { EmptyConversationFlow, type ConversationFlow } from '@nexo/contracts';

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function isTicketConsultation(value: string): boolean {
  const text = normalized(value);
  return (
    /\b(?:status|prazo|situacao|andamento)\b[^.!?]*\bchamados?\b/.test(text) ||
    /\bchamados?\b[^.!?]*\b(?:status|prazo|situacao|andamento)\b/.test(text) ||
    /\bmeus?\s+chamados?\b/.test(text) ||
    /\bconsultar\s+(?:um\s+|o\s+|meu\s+|meus\s+)?chamados?\b/.test(text) ||
    /\bacompanhar\s+(?:um\s+|o\s+|meu\s+|meus\s+)?chamados?\b/.test(text)
  );
}

function extractedFacts(message: string): Record<string, string> {
  const value = normalized(message);
  const facts: Record<string, string> = {};
  if (/\bvpn\b/.test(value)) facts.subject = 'VPN';
  else if (/\be-?mail\b/.test(value)) facts.subject = 'E-mail';
  else if (
    /\b(?:notebook|computador|monitor|impressora|wifi|rede|senha|acesso|software|aplicativo)\b/.test(
      value,
    )
  )
    facts.subject = message.trim();
  const platform = /\b(?:windows|win)\s*(10|11)\b/.exec(value)?.[1];
  if (platform) facts.platform = `Windows ${platform}`;
  const error = /\b(?:erro|codigo)\s*(?:de\s*)?(\d{3,6})\b/.exec(value)?.[1];
  if (error) facts.errorCode = error;
  if (/\b(?:so eu|somente eu)\b/.test(value)) facts.impact = 'one_person';
  if (/\b(?:equipe|time)\b/.test(value)) facts.impact = 'team';
  if (/\b(?:empresa|todos)\b/.test(value)) facts.impact = 'company';
  if (/\b(?:hoje|reuniao|prazo)\b/.test(value)) facts.urgency = 'same_day';
  return facts;
}

export function transitionConversationFlow(
  flow: ConversationFlow,
  message: string,
): ConversationFlow {
  if (isTicketConsultation(message) && flow.mode !== 'ticket_consultation') {
    const suspendedSupport =
      flow.mode === 'support'
        ? flow
        : { mode: 'support' as const, stage: 'diagnosis' as const, facts: {} };
    return { mode: 'ticket_consultation', stage: 'select_ticket', facts: {}, suspendedSupport };
  }
  if (flow.mode === 'ticket_consultation') return flow;
  const facts = {
    ...(flow.mode === 'support' ? flow.facts : EmptyConversationFlow.facts),
    ...extractedFacts(message),
  };
  const stage = !facts.impact
    ? 'diagnosis'
    : !facts.urgency
      ? 'collecting_impact'
      : 'collecting_urgency';
  return { mode: 'support', stage, facts };
}

export function resumeSupportFlow(flow: ConversationFlow): ConversationFlow {
  return flow.mode === 'ticket_consultation' ? flow.suspendedSupport : flow;
}

export function restoreConversationFlow(
  stored: ConversationFlow,
  employeeMessages: string[],
): ConversationFlow {
  if (stored.mode !== 'none') return stored;
  let restored: ConversationFlow = stored;
  for (const message of employeeMessages) restored = transitionConversationFlow(restored, message);
  return restored;
}
