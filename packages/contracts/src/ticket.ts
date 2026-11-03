import { z } from 'zod';

export const TicketTypeSchema = z.enum(['INC', 'REQ']);
export const TicketCategorySchema = z.enum(['access', 'network_vpn', 'hardware', 'software', 'email', 'other']);
export const PrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export const ImpactSchema = z.enum(['self', 'team', 'company', 'unknown']);
export const WorkStateSchema = z.enum(['stopped', 'workaround', 'request', 'unknown']);
export const UrgencySchema = z.enum(['same_day', 'normal', 'unknown']);
const text = z.string().trim().min(1).max(4000);
const id = z.string().trim().min(1).max(200);
const timestamp = z.string().datetime();

export const TicketChangeInputSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('create'), title: text.max(200), description: text, type: TicketTypeSchema, category: TicketCategorySchema, impact: ImpactSchema, workState: WorkStateSchema, urgency: UrgencySchema }),
  z.strictObject({ action: z.literal('supplement'), ticketId: id, content: text }),
  z.strictObject({ action: z.literal('reopen'), ticketId: id, reason: text }),
]);
export type TicketChangeInput = z.infer<typeof TicketChangeInputSchema>;
export const DraftInputSchema = z.discriminatedUnion('action', [
  ...TicketChangeInputSchema.options,
  z.strictObject({ action: z.literal('transfer'), ticketId: id, reason: text }),
]);
export type DraftInput = z.infer<typeof DraftInputSchema>;

export const TicketViewSchema = z.strictObject({
  id, ownerId: id, title: text.max(200), description: text, type: TicketTypeSchema, category: TicketCategorySchema,
  priority: PrioritySchema, impact: ImpactSchema.exclude(['unknown']), status: z.enum(['open', 'resolved']),
  transferRequested: z.boolean(), createdAt: timestamp, resolvedAt: timestamp.nullable(),
  slaStartedAt: timestamp, deadline: timestamp, overdue: z.boolean(),
});
export type TicketView = z.infer<typeof TicketViewSchema>;
export const TicketEventViewSchema = z.strictObject({
  id, ticketId: id, kind: z.enum(['created', 'supplemented', 'reopened', 'transfer_requested', 'support_updated']), content: text, createdAt: timestamp,
});
export type TicketEventView = z.infer<typeof TicketEventViewSchema>;
export const DraftViewSchema = z.strictObject({
  id, version: z.number().int().positive(), operationId: z.string().uuid(), status: z.enum(['pending', 'cancelled', 'committed']),
  input: DraftInputSchema, priority: PrioritySchema.optional(), candidates: z.array(TicketViewSchema).optional(),
  candidateMatches: z.array(z.strictObject({ id, match: z.enum(['exact', 'possible']) })).optional(),
}).superRefine((value, context) => {
  if (value.input.action === 'create' && (!value.priority || !value.candidates)) {
    context.addIssue({ code: 'custom', message: 'Create drafts require a priority and candidates' });
  }
});
export type DraftView = z.infer<typeof DraftViewSchema>;
export const ConfirmDraftInputSchema = z.strictObject({ version: z.number().int().positive(), operationId: z.string().uuid(), dismissedCandidateIds: z.array(id).max(100).optional() });
export type ConfirmDraftInput = z.infer<typeof ConfirmDraftInputSchema>;
export const DuplicateConflictSchema = z.strictObject({ code: z.literal('duplicate_candidates'), candidates: z.array(TicketViewSchema), candidateMatches: z.array(z.strictObject({ id, match: z.enum(['exact', 'possible']) })).optional() });
