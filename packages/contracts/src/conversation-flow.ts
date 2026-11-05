import { z } from 'zod';

const ConversationFactsSchema = z.record(z.string(), z.string());

const SupportFlowSchema = z.strictObject({
  mode: z.literal('support'),
  stage: z.enum(['diagnosis', 'collecting_impact', 'collecting_urgency', 'draft_ready']),
  facts: ConversationFactsSchema,
});

export const ConversationFlowSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('none'),
    stage: z.literal('idle'),
    facts: ConversationFactsSchema,
  }),
  SupportFlowSchema,
  z.strictObject({
    mode: z.literal('ticket_consultation'),
    stage: z.literal('select_ticket'),
    facts: ConversationFactsSchema,
    suspendedSupport: SupportFlowSchema,
  }),
]);

export type ConversationFlow = z.infer<typeof ConversationFlowSchema>;

export const EmptyConversationFlow: ConversationFlow = {
  mode: 'none',
  stage: 'idle',
  facts: {},
};
