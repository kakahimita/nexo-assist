import type { TicketChangeInput } from '@nexo/contracts';

type CreateInput = Extract<TicketChangeInput, { action: 'create' }>;
type ExplicitFacts = Pick<CreateInput, 'impact' | 'workState' | 'urgency'>;
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[.!?]+$/u, '')
    .replace(/\s+/gu, ' ');
const impact: Record<string, CreateInput['impact']> = {
  'somente eu': 'self',
  'so eu': 'self',
  'minha equipe': 'team',
  'toda a empresa': 'company',
};
const workState: Record<string, CreateInput['workState']> = {
  'nao consigo trabalhar': 'stopped',
  'trabalho parado': 'stopped',
  'consigo trabalhar com alternativa': 'workaround',
  'trabalho afetado com alternativa': 'workaround',
  'pedido ou melhoria': 'request',
};
const urgency: Record<string, CreateInput['urgency']> = {
  'compromisso em risco hoje': 'same_day',
  'sem compromisso em risco hoje': 'normal',
};

export function activeRequestMessages(messages: readonly string[]): readonly string[] {
  let start = -1;
  for (let index = 0; index < messages.length; index++) {
    if (
      /^(?:(?:quero|preciso) )?(?:abrir|criar|novo) (?:um )?chamado\b/u.test(
        normalize(messages[index] ?? ''),
      )
    )
      start = index;
  }
  return start < 0 ? [] : messages.slice(start);
}

export function explicitFacts(messages: readonly string[]): Partial<ExplicitFacts> {
  const facts: Partial<ExplicitFacts> = {};
  for (const message of activeRequestMessages(messages).slice(1))
    for (const line of message.split('\n')) {
      const answer = normalize(line);
      if (answer === 'nao sei' || answer === 'nao tenho certeza') {
        delete facts.impact;
        delete facts.workState;
        delete facts.urgency;
        continue;
      }
      if (impact[answer]) facts.impact = impact[answer];
      if (workState[answer]) facts.workState = workState[answer];
      if (urgency[answer]) facts.urgency = urgency[answer];
    }
  return facts;
}

export function deriveClassification(
  messages: readonly string[],
  workState: CreateInput['workState'],
): { type: CreateInput['type']; category: CreateInput['category'] } | null {
  const source = activeRequestMessages(messages);
  const details = source.map(normalize);
  let explicitCategory: CreateInput['category'] | undefined;
  const categoryAnswers: Record<string, CreateInput['category']> = {
    hardware: 'hardware',
    'rede e vpn': 'network_vpn',
    acesso: 'access',
    software: 'software',
    email: 'email',
    outros: 'other',
  };
  for (const line of details.flatMap((message) => message.split('\n')))
    if (categoryAnswers[line]) explicitCategory = categoryAnswers[line];
  const text = details.join(' ');
  const categories: CreateInput['category'][] = [];
  if (/\b(?:notebook|computador|monitor|impressora|projetor)\b/u.test(text))
    categories.push('hardware');
  if (/\b(?:vpn|rede|wifi)\b/u.test(text)) categories.push('network_vpn');
  if (/\b(?:senha|acesso)\b/u.test(text)) categories.push('access');
  if (/\b(?:email|e-mail)\b/u.test(text)) categories.push('email');
  if (/\b(?:software|aplicativo)\b/u.test(text)) categories.push('software');
  const category = explicitCategory ?? (categories.length === 1 ? categories[0] : undefined);
  const failure = /nao liga|nao funciona|parou|falha|erro|travou|lento|devagar|bloquead/u.test(
    text,
  );
  const type = workState === 'request' ? 'REQ' : failure ? 'INC' : undefined;
  if (!category || !type) return null;
  return { type, category };
}
