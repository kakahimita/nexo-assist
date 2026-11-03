import { createTool } from '@mastra/core/tools';
import { UserViewSchema } from '@nexo/contracts';
import { ConsultTicketsInputSchema, ConsultTicketsResultSchema, SearchKnowledgeInputSchema, SearchKnowledgeResultSchema } from './consultation-tool-schemas.js';
import type { ConsultationTools } from './consultation-tools.js';

export function createConsultationTools(tools: ConsultationTools) {
  return {
    consultTickets: createTool({ id: 'consult-tickets', description: 'Consult only the authenticated employee tickets.', inputSchema: ConsultTicketsInputSchema, outputSchema: ConsultTicketsResultSchema, execute: async (input, context) => {
      const parsed = ConsultTicketsInputSchema.parse(input);
      const user = UserViewSchema.parse(context?.requestContext?.get('user'));
      const now = context?.requestContext?.get('now');
      if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('Missing request clock');
      return tools.consultTickets(user, parsed, now);
    } }),
    searchKnowledge: createTool({ id: 'search-knowledge', description: 'Search IT knowledge articles and their platform applicability.', inputSchema: SearchKnowledgeInputSchema, outputSchema: SearchKnowledgeResultSchema, execute: async (input, context) => {
      const parsed = SearchKnowledgeInputSchema.parse(input);
      const user = UserViewSchema.parse(context?.requestContext?.get('user'));
      return tools.searchKnowledge(user, parsed);
    } }),
  };
}
