import { normalizeTitle } from './normalize-title.js';
import { isActiveStatus } from './rules.js';
import type { TicketStatus } from '@nexo/contracts';

type CandidateTicket = { id: string; title: string; description: string; status: string };
type TicketMatch = 'exact' | 'possible';
const ignored = new Set([
  'apos',
  'com',
  'como',
  'das',
  'depois',
  'para',
  'por',
  'que',
  'sem',
  'uma',
  'muito',
  'ficou',
  'esta',
  'funciona',
  'nao',
  'meu',
  'minha',
]);
const equivalents: Record<string, string> = {
  computador: 'notebook',
  portatil: 'notebook',
  equipamento: 'notebook',
  laptop: 'notebook',
  devagar: 'lento',
  lentidao: 'lento',
  lentos: 'lento',
  lenta: 'lento',
};
function tokens(value: string): Set<string> {
  return new Set(
    value
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3 && !ignored.has(word))
      .map((word) => equivalents[word] ?? word),
  );
}

export function findTicketCandidates<T extends CandidateTicket>(
  input: { title: string; description: string },
  tickets: readonly T[],
): Array<{ ticket: T; match: TicketMatch }> {
  const normalizedTitle = normalizeTitle(input.title);
  const query = tokens(`${input.title} ${input.description}`);
  const matches: Array<{ ticket: T; match: TicketMatch }> = [];
  for (const ticket of tickets) {
    if (!isActiveStatus(ticket.status as TicketStatus)) continue;
    if (normalizeTitle(ticket.title) === normalizedTitle) {
      matches.push({ ticket, match: 'exact' });
      continue;
    }
    const words = tokens(`${ticket.title} ${ticket.description}`);
    const shared = [...query].filter((word) => words.has(word));
    if (shared.length >= 2) matches.push({ ticket, match: 'possible' });
  }
  return matches;
}
