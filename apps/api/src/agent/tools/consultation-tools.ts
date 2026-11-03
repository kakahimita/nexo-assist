import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { UserView } from '@nexo/contracts';
import { KnowledgeService, normalizePlatform } from '../../knowledge/knowledge.service.js';
import { assertEmployee, TicketService } from '../../tickets/ticket-service.js';
import { ConsultTicketsInputSchema, ConsultTicketsResultSchema, SearchKnowledgeInputSchema, SearchKnowledgeResultSchema } from './consultation-tool-schemas.js';

const normalize = (value: string): string => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
@Injectable()
export class ConsultationTools {
  constructor(@Inject(TicketService) private readonly tickets: TicketService, @Inject(KnowledgeService) private readonly knowledge: KnowledgeService) {}
  async consultTickets(user: UserView, input: unknown, now: Date) {
    if (!user) throw new UnauthorizedException();
    assertEmployee(user);
    const { query, kind = 'any' } = ConsultTicketsInputSchema.parse(input);
    const owned = await this.tickets.list(user, now);
    const candidates = owned.map(({ id, title, status, priority, deadline, overdue }) => ({ id, title, status, priority, deadline, overdue }));
    const normalizedQuery = query === undefined ? '' : normalize(query).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const genericStatus = kind !== 'reference' && /^(?:(?:qual|quais) (?:e |sao )?(?:o |os )?)?(?:status(?: (?:do|de|dos) (?:meu |meus )?chamados?)?|(?:meus? )?chamados?)$/.test(normalizedQuery);
    const reference = kind === 'reference' || (query !== undefined && /^(?:inc|req)-[a-z0-9-]+$/i.test(query));
    const found = query && !genericStatus ? candidates.filter((ticket) => reference ? normalize(ticket.id) === normalize(query) : normalize(ticket.title).includes(normalize(query)) || normalize(ticket.id) === normalize(query)) : candidates;
    const unknownReference = !!query && reference && found.length === 0;
    return ConsultTicketsResultSchema.parse({ match: unknownReference ? 'unknown_reference' : found.length === 0 ? 'none' : found.length === 1 ? 'one' : 'multiple', requestedQuery: query ?? null, tickets: unknownReference ? candidates : found });
  }
  async searchKnowledge(user: UserView, input: unknown) {
    if (!user) throw new UnauthorizedException();
    assertEmployee(user);
    const { query, platform } = SearchKnowledgeInputSchema.parse(input);
    return SearchKnowledgeResultSchema.parse({ platform: normalizePlatform(platform), matches: await this.knowledge.search(query, platform) });
  }
}
