import { z } from 'zod';
import { ConsultationActionSchema, ConsultationDecisionViewSchema, ConsultationErrorCodeSchema } from './consultation.js';

export const ConversationViewSchema = z.strictObject({ id: z.string(), createdAt: z.string().datetime() });
export type ConversationView = z.infer<typeof ConversationViewSchema>;
export const MessageViewSchema = z.strictObject({ id: z.string(), content: z.string(), createdAt: z.string().datetime(), role: z.enum(['employee', 'agent']), status: z.enum(['completed', 'failed']), decision: ConsultationDecisionViewSchema.nullable() });
export type MessageView = z.infer<typeof MessageViewSchema>;
export const MessageInputSchema = z.strictObject({ content: z.string().max(4000).refine((value) => value.trim().length > 0) });
export type MessageInput = z.infer<typeof MessageInputSchema>;
export const ConsultationStreamEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('user-message'), message: MessageViewSchema }),
  z.strictObject({ type: z.literal('text-delta'), text: z.string() }),
  z.strictObject({ type: z.literal('action'), action: ConsultationActionSchema }),
  z.strictObject({ type: z.literal('done'), message: MessageViewSchema }),
  z.strictObject({ type: z.literal('error'), code: ConsultationErrorCodeSchema }),
]);
export type ConsultationStreamEvent = z.infer<typeof ConsultationStreamEventSchema>;

export const CONVERSATION_MESSAGE_LIMIT = 30;
export const SessionLimitResponseSchema = z.strictObject({ code: z.literal('session_limit'), limit: z.number().int().positive(), used: z.number().int().nonnegative() });
export type SessionLimitResponse = z.infer<typeof SessionLimitResponseSchema>;
