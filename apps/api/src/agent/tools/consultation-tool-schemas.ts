import { z } from 'zod';
import { ConsultationTicketViewSchema, TicketViewSchema } from '@nexo/contracts';
const query = z.string().trim().min(1).max(400);
const proposalText = z.string().trim().min(1).max(4000);
const proposalId = z.string().trim().min(1).max(200);
export const ConsultTicketsInputSchema = z.strictObject({
  query: query.optional(),
  kind: z.enum(['any', 'reference', 'topic']).optional(),
});
export const SearchKnowledgeInputSchema = z.strictObject({
  query,
  platform: z.string().trim().min(1).max(100).optional(),
});
export const ConsultTicketsResultSchema = z.strictObject({
  match: z.enum(['none', 'one', 'multiple', 'unknown_reference']),
  requestedQuery: z.string().nullable(),
  tickets: z.array(ConsultationTicketViewSchema),
});
export const SearchKnowledgeResultSchema = z.strictObject({
  platform: z.enum(['windows10', 'windows11', 'unknown']),
  matches: z.array(
    z.strictObject({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      body: z.string(),
      platform: z.enum(['windows10', 'windows11', 'any']),
      applicability: z.enum(['applicable', 'platform_mismatch', 'platform_unknown']),
      reason: z.string(),
    }),
  ),
});
// The model proposes only a title and description; the server derives type,
// category, impact, work state and urgency from the employee's explicit answers.
export const ProposalInputSchema = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('create'),
    title: proposalText.max(200),
    description: proposalText,
    requiresAnalyst: z.boolean().optional(),
  }),
  z.strictObject({
    action: z.literal('supplement'),
    ticketId: proposalId,
    content: proposalText,
    requiresAnalyst: z.boolean().optional(),
  }),
  z.strictObject({
    action: z.literal('reopen'),
    ticketId: proposalId,
    reason: proposalText,
    requiresAnalyst: z.boolean().optional(),
  }),
]);
export const ProposeTicketDraftResultSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('draft'), draftId: z.string().min(1) }),
  z.strictObject({
    status: z.literal('duplicate_candidates'),
    candidates: z.array(TicketViewSchema),
    candidateMatches: z
      .array(z.strictObject({ id: z.string(), match: z.enum(['exact', 'possible']) }))
      .default([]),
  }),
  z.strictObject({ status: z.literal('ticket_not_found') }),
  z.strictObject({ status: z.literal('not_open') }),
  z.strictObject({ status: z.literal('already_open') }),
  z.strictObject({ status: z.literal('reopen_not_allowed') }),
  z.strictObject({ status: z.literal('critical_requires_handoff') }),
]);
