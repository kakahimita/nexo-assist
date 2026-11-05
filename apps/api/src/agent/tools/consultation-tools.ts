import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  ConsultationActionSchema,
  ConsultationTicketViewSchema,
  type TicketChangeInput,
  type UserView,
} from '@nexo/contracts';
import { z } from 'zod';
import { KnowledgeService, normalizePlatform } from '../../knowledge/knowledge.service.js';
import { assertEmployee, TicketService } from '../../tickets/ticket-service.js';
import { DraftsService } from '../../tickets/drafts.service.js';
import { findTicketCandidates } from '../../tickets/ticket-candidates.js';
import { canReopen, canSupplement, classifyPriority, isActiveStatus } from '../../tickets/rules.js';
import { DatabaseService } from '../../database/database.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { activeRequestMessages, deriveClassification, explicitFacts } from './explicit-facts.js';
import {
  ConsultTicketsInputSchema,
  ConsultTicketsResultSchema,
  ProposalInputSchema,
  ProposeTicketDraftResultSchema,
  SearchKnowledgeInputSchema,
  SearchKnowledgeResultSchema,
} from './consultation-tool-schemas.js';

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
@Injectable()
export class ConsultationTools {
  constructor(
    @Inject(TicketService) private readonly tickets: TicketService,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(DraftsService) private readonly drafts: DraftsService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async proposeDraft(
    user: UserView,
    input: unknown,
    context: { conversationId: string; runId: string; now: Date },
  ) {
    if (!user) throw new UnauthorizedException();
    assertEmployee(user);
    if (
      !(await this.database.client.conversation.findFirst({
        where: { id: context.conversationId, ownerId: user.id },
        select: { id: true },
      }))
    )
      throw new NotFoundException();
    const proposal = ProposalInputSchema.parse(input);
    let change: TicketChangeInput;
    if (proposal.action === 'create') {
      const messages = await this.database.client.message.findMany({
        where: { conversationId: context.conversationId, role: 'employee' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { content: true },
      });
      const source = messages.map(({ content }) => content);
      const facts = explicitFacts(source);
      if (!facts.impact || !facts.workState || !facts.urgency)
        throw new BadRequestException('Explicit impact, work state and urgency are required');
      if (
        classifyPriority({
          impact: facts.impact,
          workState: facts.workState,
          urgency: facts.urgency,
        }) === 'critical'
      )
        return ProposeTicketDraftResultSchema.parse({ status: 'critical_requires_handoff' });
      const classification = deriveClassification(source, facts.workState);
      if (!classification)
        throw new BadRequestException('Ticket type and category must be supported by the employee');
      const parts = activeRequestMessages(source).map((message) =>
        normalize(message)
          .replace(/[^\p{L}\p{N}]+/gu, ' ')
          .trim(),
      );
      const supported = (value: string) => {
        const text = normalize(value)
          .replace(/[^\p{L}\p{N}]+/gu, ' ')
          .trim();
        return text.length > 0 && parts.some((part) => part.includes(text));
      };
      if (!supported(proposal.title) || !supported(proposal.description))
        throw new BadRequestException('Title and description must be supported by the employee');
      change = {
        action: 'create',
        title: proposal.title,
        description: proposal.description,
        type: classification.type,
        category: classification.category,
        impact: facts.impact,
        workState: facts.workState,
        urgency: facts.urgency,
      };
    } else {
      change = proposal;
    }
    const owned = await this.tickets.list(user, context.now);
    if (change.action === 'create') {
      const matches = findTicketCandidates(change, owned);
      if (matches.length) {
        let reviewed = false;
        if (matches.every(({ match }) => match === 'possible')) {
          const lastEmployee = await this.database.client.message.findFirst({
            where: { conversationId: context.conversationId, role: 'employee' },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: { content: true },
          });
          const lastAgent = await this.database.client.message.findFirst({
            where: { conversationId: context.conversationId, role: 'agent' },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            include: { decision: true },
          });
          if (
            normalize(lastEmployee?.content ?? '').trim() === 'sao outros problemas' &&
            lastAgent?.decision
          ) {
            try {
              const shown = z
                .array(ConsultationTicketViewSchema)
                .parse(JSON.parse(lastAgent.decision.ticketsJson) as unknown);
              const actions = z
                .array(ConsultationActionSchema)
                .parse(JSON.parse(lastAgent.decision.actionsJson) as unknown);
              const ids = new Set(shown.map(({ id }) => id));
              reviewed =
                actions.some(
                  (action) => action.tool === 'propose-ticket-draft' && action.status === 'failed',
                ) &&
                ids.size === matches.length &&
                matches.every(({ ticket }) => ids.has(ticket.id));
            } catch {
              reviewed = false;
            }
          }
        }
        if (!reviewed)
          return ProposeTicketDraftResultSchema.parse({
            status: 'duplicate_candidates',
            candidates: matches.map(({ ticket }) => ticket),
            candidateMatches: matches.map(({ ticket, match }) => ({ id: ticket.id, match })),
          });
      }
    } else {
      const ticket = owned.find((item) => item.id === change.ticketId);
      if (!ticket) return ProposeTicketDraftResultSchema.parse({ status: 'ticket_not_found' });
      const latest = await this.database.client.message.findFirst({
        where: { conversationId: context.conversationId, role: 'employee' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { content: true },
      });
      const employeeText = normalize(latest?.content ?? '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
      const proposedText = normalize(
        change.action === 'supplement' ? change.content : change.reason,
      )
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
      if (!proposedText || !employeeText.includes(proposedText))
        throw new BadRequestException('The employee must provide the proposed content');
      if (change.action === 'supplement' && !canSupplement(ticket.status))
        return ProposeTicketDraftResultSchema.parse({ status: 'not_open' });
      if (change.action === 'reopen') {
        if (isActiveStatus(ticket.status))
          return ProposeTicketDraftResultSchema.parse({ status: 'already_open' });
        if (
          !ticket.resolvedAt ||
          !canReopen(ticket.status, new Date(ticket.resolvedAt), context.now)
        )
          return ProposeTicketDraftResultSchema.parse({ status: 'reopen_not_allowed' });
        const matches = findTicketCandidates(ticket, owned);
        if (matches.length)
          return ProposeTicketDraftResultSchema.parse({
            status: 'duplicate_candidates',
            candidates: matches.map(({ ticket: match }) => match),
          });
      }
    }
    const draft = await this.drafts.createForRun(user, change, context);
    return ProposeTicketDraftResultSchema.parse({ status: 'draft', draftId: draft.id });
  }
  async consultTickets(user: UserView, input: unknown, now: Date) {
    if (!user) throw new UnauthorizedException();
    assertEmployee(user);
    const { query, kind = 'any' } = ConsultTicketsInputSchema.parse(input);
    const owned = await this.tickets.list(user, now);
    const candidates = owned.map(
      ({
        id,
        number,
        title,
        description,
        status,
        priority,
        category,
        createdAt,
        deadline,
        slaStartedAt,
        overdue,
      }) => ({
        id,
        number,
        title,
        description,
        status,
        priority,
        category,
        createdAt,
        deadline,
        lastUpdate: slaStartedAt,
        overdue,
      }),
    );
    const normalizedQuery =
      query === undefined
        ? ''
        : normalize(query)
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .trim();
    const genericStatus =
      kind !== 'reference' &&
      /^(?:(?:qual|quais) (?:e |sao )?(?:o |os )?)?(?:status(?: (?:do|de|dos) (?:meu |meus )?chamados?)?|(?:meus? )?chamados?)$/.test(
        normalizedQuery,
      );
    const reference =
      kind === 'reference' || (query !== undefined && /^(?:inc|req)-[a-z0-9-]+$/i.test(query));
    const found =
      query && !genericStatus
        ? candidates.filter((ticket) =>
            reference
              ? normalize(ticket.number ?? '') === normalize(query) ||
                normalize(ticket.id) === normalize(query)
              : normalize(ticket.title).includes(normalize(query)) ||
                normalize(ticket.number ?? '') === normalize(query) ||
                normalize(ticket.id) === normalize(query),
          )
        : candidates;
    const unknownReference = !!query && reference && found.length === 0;
    return ConsultTicketsResultSchema.parse({
      match: unknownReference
        ? 'unknown_reference'
        : found.length === 0
          ? 'none'
          : found.length === 1
            ? 'one'
            : 'multiple',
      requestedQuery: query ?? null,
      tickets: unknownReference ? candidates : found,
    });
  }
  async searchKnowledge(user: UserView, input: unknown) {
    if (!user) throw new UnauthorizedException();
    assertEmployee(user);
    const { query, platform } = SearchKnowledgeInputSchema.parse(input);
    return SearchKnowledgeResultSchema.parse({
      platform: normalizePlatform(platform),
      matches: await this.knowledge.search(query, platform),
    });
  }
}
