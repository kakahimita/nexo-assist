import { ConsultationStreamEventSchema, type ConsultationStreamEvent } from '@nexo/contracts';
export function encodeSse(event: ConsultationStreamEvent): string {
  return `data: ${JSON.stringify(ConsultationStreamEventSchema.parse(event))}\n\n`;
}
