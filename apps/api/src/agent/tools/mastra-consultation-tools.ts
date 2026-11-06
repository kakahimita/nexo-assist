import { createTool } from '@mastra/core/tools';
import { UserViewSchema } from '@nexo/contracts';
import {
  ConsultTicketsInputSchema,
  ConsultTicketsResultSchema,
  ModelProposalInputSchema,
  ProposeTicketDraftResultSchema,
  SearchKnowledgeInputSchema,
  SearchKnowledgeResultSchema,
} from './consultation-tool-schemas.js';
import type { ConsultationTools } from './consultation-tools.js';

export function modelSafe(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(modelSafe);
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === null || item === undefined) continue;
      result[key] = modelSafe(item);
    }
    return result;
  }
  return value;
}

export function createConsultationTools(tools: ConsultationTools) {
  return {
    proposeDraft: createTool({
      id: 'propose-ticket-draft',
      description:
        'Propose a draft for review. For create, interpret the current problem and cite employee message IDs and exact quotations for every fact. Never guess missing/ambiguous facts or write a ticket. The server derives priority.',
      inputSchema: ModelProposalInputSchema,
      outputSchema: ProposeTicketDraftResultSchema,
      toModelOutput: (result) => ({ type: 'json', value: modelSafe(result) as never }),
      execute: async (input, context) => {
        const user = UserViewSchema.parse(context?.requestContext?.get('user'));
        const now = context?.requestContext?.get('now');
        const conversationId = context?.requestContext?.get('conversationId');
        const runId = context?.requestContext?.get('runId');
        const messageIds = context?.requestContext?.get('messageIds');
        if (
          !(now instanceof Date) ||
          Number.isNaN(now.getTime()) ||
          typeof conversationId !== 'string' ||
          typeof runId !== 'string'
        )
          throw new Error('Missing server context');
        const parsed = ModelProposalInputSchema.parse(input);
        if (parsed.action === 'create' && !Array.isArray(messageIds))
          throw new Error('Missing server message snapshot');
        return tools.proposeDraft(user, parsed, {
          now,
          conversationId,
          runId,
          ...(Array.isArray(messageIds) && messageIds.every((id) => typeof id === 'string')
            ? { messageIds }
            : {}),
        });
      },
    }),
    consultTickets: createTool({
      id: 'consult-tickets',
      description: 'Consult only the authenticated employee tickets.',
      inputSchema: ConsultTicketsInputSchema,
      outputSchema: ConsultTicketsResultSchema,
      toModelOutput: (result) => ({ type: 'json', value: modelSafe(result) as never }),
      execute: async (input, context) => {
        const parsed = ConsultTicketsInputSchema.parse(input);
        const user = UserViewSchema.parse(context?.requestContext?.get('user'));
        const now = context?.requestContext?.get('now');
        if (!(now instanceof Date) || Number.isNaN(now.getTime()))
          throw new Error('Missing request clock');
        return tools.consultTickets(user, parsed, now);
      },
    }),
    searchKnowledge: createTool({
      id: 'search-knowledge',
      description: 'Search IT knowledge articles and their platform applicability.',
      inputSchema: SearchKnowledgeInputSchema,
      outputSchema: SearchKnowledgeResultSchema,
      toModelOutput: (result) => ({
        type: 'json',
        value: {
          ...result,
          matches: result.matches.map((article) =>
            article.applicability === 'applicable'
              ? article
              : { ...article, summary: '', body: '' },
          ),
        },
      }),
      execute: async (input, context) => {
        const parsed = SearchKnowledgeInputSchema.parse(input);
        const user = UserViewSchema.parse(context?.requestContext?.get('user'));
        return tools.searchKnowledge(user, parsed);
      },
    }),
  };
}
