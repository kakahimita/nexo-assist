import { z } from 'zod';
import {
  ConversationStateSchema,
  HandoffViewSchema,
  MessageViewSchema,
} from './conversation.js';
import { TicketViewSchema } from './ticket.js';

export const SupportConversationFilterSchema = z.enum(['all', 'waiting', 'owned']);
export type SupportConversationFilter = z.infer<typeof SupportConversationFilterSchema>;

export const SupportConversationSummarySchema = z.strictObject({
  id: z.string(),
  state: ConversationStateSchema,
  stateVersion: z.number().int().nonnegative(),
  employee: z.strictObject({ id: z.string(), name: z.string() }),
  handoff: HandoffViewSchema.nullable(),
  assignedAnalystId: z.string().nullable(),
  closedAt: z.string().datetime().nullable(),
  lastMessage: z
    .strictObject({
      content: z.string(),
      role: z.enum(['employee', 'agent', 'analyst']),
      createdAt: z.string().datetime(),
    })
    .nullable(),
});
export type SupportConversationSummary = z.infer<typeof SupportConversationSummarySchema>;

export const SupportConversationViewSchema = z.strictObject({
  conversation: SupportConversationSummarySchema,
  messages: z.array(MessageViewSchema),
  tickets: z.array(TicketViewSchema),
});
export type SupportConversationView = z.infer<typeof SupportConversationViewSchema>;

export const SupportReplyInputSchema = z.strictObject({
  content: z
    .string()
    .max(4000)
    .refine((value) => value.trim().length > 0),
});
export type SupportReplyInput = z.infer<typeof SupportReplyInputSchema>;
