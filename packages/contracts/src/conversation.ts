import { z } from 'zod';

export const ConversationViewSchema = z.strictObject({ id: z.string(), createdAt: z.string().datetime() });
export type ConversationView = z.infer<typeof ConversationViewSchema>;
export const MessageViewSchema = z.strictObject({ id: z.string(), content: z.string(), createdAt: z.string().datetime() });
export type MessageView = z.infer<typeof MessageViewSchema>;
export const MessageInputSchema = z.strictObject({ content: z.string().max(4000).refine((value) => value.trim().length > 0) });
export type MessageInput = z.infer<typeof MessageInputSchema>;
