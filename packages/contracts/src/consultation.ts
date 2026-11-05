import { z } from 'zod';
import { PrioritySchema, TicketCategorySchema, TicketStatusSchema } from './ticket.js';

export const ConsultationErrorCodeSchema = z.enum([
  'model_unavailable',
  'quota',
  'invalid_output',
  'interrupted',
]);
export const ConsultationToolNameSchema = z.enum([
  'consult-tickets',
  'search-knowledge',
  'propose-ticket-draft',
]);
export type ConsultationToolName = z.infer<typeof ConsultationToolNameSchema>;
export const ConsultationActionSchema = z.strictObject({
  id: z.string(),
  tool: ConsultationToolNameSchema,
  status: z.enum(['succeeded', 'failed']),
  label: z.string(),
  summary: z.string(),
});
export const ConsultationEvidenceSchema = z.strictObject({
  kind: z.enum(['ticket', 'article']),
  id: z.string(),
  title: z.string(),
});
export const ConsultationTicketViewSchema = z.strictObject({
  id: z.string(),
  number: z.string().nullable().default(null),
  title: z.string(),
  description: z.string().nullable().default(null),
  status: TicketStatusSchema,
  priority: PrioritySchema,
  category: TicketCategorySchema.nullable().default(null),
  createdAt: z.string().datetime().nullable().default(null),
  deadline: z.string().datetime(),
  lastUpdate: z.string().datetime().nullable().default(null),
  overdue: z.boolean(),
});
export const ConsultationEngineDecisionSchema = z.strictObject({
  intent: z.string(),
  action: z.enum(['answer', 'clarify', 'redirect', 'handoff']),
  appliedRule: z.string(),
  confidence: z.number().min(0).max(1),
  justification: z.string(),
  missingFacts: z.array(z.string()),
  quickReplies: z.array(z.string()).max(4),
  reply: z.string().trim().min(1).max(4000).optional(),
});
export const ConsultationDecisionViewSchema = z
  .strictObject({
    intent: z.string(),
    action: z.enum(['answer', 'clarify', 'redirect', 'handoff', 'unavailable']),
    appliedRule: z.string(),
    confidence: z.number().min(0).max(1),
    justification: z.string(),
    missingFacts: z.array(z.string()),
    quickReplies: z.array(z.string()).max(4),
    actions: z.array(ConsultationActionSchema),
    evidence: z.array(ConsultationEvidenceSchema),
    tickets: z.array(ConsultationTicketViewSchema),
    outcome: z.enum(['completed', 'failed']),
    errorCode: ConsultationErrorCodeSchema.nullable(),
    source: z.enum(['live', 'deterministic']),
    draftId: z.string().min(1).nullable().default(null),
  })
  .refine((value) => (value.outcome === 'completed') === (value.errorCode === null), {
    message: 'Outcome and error code must agree',
  });
export type ConsultationAction = z.infer<typeof ConsultationActionSchema>;
export type ConsultationEvidence = z.infer<typeof ConsultationEvidenceSchema>;
export type ConsultationTicketView = z.infer<typeof ConsultationTicketViewSchema>;
export type ConsultationEngineDecision = z.infer<typeof ConsultationEngineDecisionSchema>;
export type ConsultationDecisionView = z.infer<typeof ConsultationDecisionViewSchema>;
