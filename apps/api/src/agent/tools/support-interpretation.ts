import { BadRequestException } from '@nestjs/common';
import { TicketCategorySchema } from '@nexo/contracts';
import { z } from 'zod';

const EvidenceSchema = z.strictObject({
  messageId: z.string().min(1).max(200),
  quote: z.string().trim().min(3).max(1000),
});
const fact = <T extends z.ZodType>(value: T) => z.strictObject({ value, evidence: EvidenceSchema });

export const SupportInterpretationSchema = z.strictObject({
  requestStartMessageId: z.string().min(1).max(200),
  type: fact(z.enum(['INC', 'REQ'])),
  category: fact(TicketCategorySchema),
  impact: fact(z.enum(['self', 'team', 'company'])),
  workState: fact(z.enum(['stopped', 'workaround', 'request'])),
  urgency: fact(z.enum(['same_day', 'normal'])),
});

// Provenance is verified here. Semantic entailment is the model's responsibility
// and must be evaluated with real conversations, including negations/corrections.
export function validateSupportInterpretation(
  input: unknown,
  messages: readonly { id: string; content: string }[],
  snapshotIds?: readonly string[],
) {
  const parsed = SupportInterpretationSchema.parse(input);
  const available = snapshotIds
    ? messages.filter((message) => snapshotIds.includes(message.id))
    : messages;
  const start = available.findIndex((message) => message.id === parsed.requestStartMessageId);
  if (start < 0)
    throw new BadRequestException('Current problem must start in an owned employee message');
  const current = available.slice(start);
  for (const field of ['type', 'category', 'impact', 'workState', 'urgency'] as const) {
    const evidence = parsed[field].evidence;
    const message = current.find((item) => item.id === evidence.messageId);
    if (!message || !message.content.includes(evidence.quote))
      throw new BadRequestException(`Unsupported ${field} evidence in the current problem`);
  }
  return {
    type: parsed.type.value,
    category: parsed.category.value,
    impact: parsed.impact.value,
    workState: parsed.workState.value,
    urgency: parsed.urgency.value,
    source: current.map((message) => message.content),
  };
}
