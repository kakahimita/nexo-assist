import { z } from 'zod';
import {
  ConsultationActionSchema,
  ConsultationDecisionViewSchema,
  ConsultationErrorCodeSchema,
} from './consultation.js';
import { ConversationFlowSchema } from './conversation-flow.js';

export const ConversationViewSchema = z.strictObject({
  id: z.string(),
  createdAt: z.string().datetime(),
  state: z.enum(['agent', 'waiting_for_analyst', 'with_analyst', 'closed']),
  stateVersion: z.number().int().nonnegative(),
  handoff: z
    .strictObject({
      reason: z.enum([
        'employee_request',
        'critical_incident',
        'overdue_ticket',
        'unresolved_uncertainty',
      ]),
      summary: z.string().min(1).max(2000),
      requestedAt: z.string().datetime(),
    })
    .nullable(),
  assignedAnalystId: z.string().nullable(),
  closedAt: z.string().datetime().nullable(),
  flow: ConversationFlowSchema,
  latestMessage: z
    .strictObject({
      content: z.string(),
      createdAt: z.string().datetime(),
      role: z.enum(['employee', 'agent', 'analyst']),
    })
    .nullable()
    .default(null),
  contextTicketNumber: z.string().nullable().default(null),
});
export type ConversationView = z.infer<typeof ConversationViewSchema>;
export const ConversationStateSchema = z.enum([
  'agent',
  'waiting_for_analyst',
  'with_analyst',
  'closed',
]);
export type ConversationState = z.infer<typeof ConversationStateSchema>;
export const HandoffReasonSchema = z.enum([
  'employee_request',
  'critical_incident',
  'overdue_ticket',
  'unresolved_uncertainty',
]);
export type HandoffReason = z.infer<typeof HandoffReasonSchema>;
export const HandoffViewSchema = z.strictObject({
  reason: HandoffReasonSchema,
  summary: z.string().min(1).max(2000),
  requestedAt: z.string().datetime(),
});
export type HandoffView = z.infer<typeof HandoffViewSchema>;
export const RequestHandoffInputSchema = z.strictObject({ reason: HandoffReasonSchema });
export type RequestHandoffInput = z.infer<typeof RequestHandoffInputSchema>;
export const MessageViewSchema = z.strictObject({
  id: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
  role: z.enum(['employee', 'agent', 'analyst']),
  status: z.enum(['completed', 'failed']),
  decision: ConsultationDecisionViewSchema.nullable(),
  authorName: z.string().nullable(),
});
export type MessageView = z.infer<typeof MessageViewSchema>;
export const MessageInputSchema = z.strictObject({
  content: z
    .string()
    .max(4000)
    .refine((value) => value.trim().length > 0),
});
export type MessageInput = z.infer<typeof MessageInputSchema>;
export const ConsultationStreamEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('user-message'), message: MessageViewSchema }),
  z.strictObject({ type: z.literal('text-delta'), text: z.string() }),
  z.strictObject({ type: z.literal('action'), action: ConsultationActionSchema }),
  z.strictObject({ type: z.literal('done'), message: MessageViewSchema }),
  z.strictObject({ type: z.literal('handoff-waiting') }),
  z.strictObject({ type: z.literal('error'), code: ConsultationErrorCodeSchema }),
]);
export type ConsultationStreamEvent = z.infer<typeof ConsultationStreamEventSchema>;

export const CONVERSATION_MESSAGE_LIMIT = 30;
export const SessionLimitResponseSchema = z.strictObject({
  code: z.literal('session_limit'),
  limit: z.number().int().positive(),
  used: z.number().int().nonnegative(),
});
export type SessionLimitResponse = z.infer<typeof SessionLimitResponseSchema>;
