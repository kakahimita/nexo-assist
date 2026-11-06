import type { Prisma } from '../generated/prisma/client.js';

export const TICKET_NUMBER_START = { INC: 20000, REQ: 10000 } as const;

export function formatTicketNumber(type: 'INC' | 'REQ', number: number): string {
  return `${type}-${String(number).padStart(5, '0')}`;
}

export async function allocateTicketNumber(
  tx: Prisma.TransactionClient,
  type: 'INC' | 'REQ',
): Promise<number> {
  const row = await tx.ticketNumberSequence.upsert({
    where: { type },
    create: { type, value: TICKET_NUMBER_START[type] },
    update: { value: { increment: 1 } },
  });
  return row.value;
}
