import { z } from 'zod';
import { ConsultationTicketViewSchema } from '@nexo/contracts';
const query = z.string().trim().min(1).max(400);
export const ConsultTicketsInputSchema = z.strictObject({ query: query.optional(), kind: z.enum(['any', 'reference', 'topic']).optional() });
export const SearchKnowledgeInputSchema = z.strictObject({ query, platform: z.string().trim().min(1).max(100).optional() });
export const ConsultTicketsResultSchema = z.strictObject({ match: z.enum(['none', 'one', 'multiple', 'unknown_reference']), requestedQuery: z.string().nullable(), tickets: z.array(ConsultationTicketViewSchema) });
export const SearchKnowledgeResultSchema = z.strictObject({ platform: z.enum(['windows10', 'windows11', 'unknown']), matches: z.array(z.strictObject({ id: z.string(), title: z.string(), summary: z.string(), body: z.string(), platform: z.enum(['windows10', 'windows11', 'any']), applicability: z.enum(['applicable', 'platform_mismatch', 'platform_unknown']), reason: z.string() })) });
