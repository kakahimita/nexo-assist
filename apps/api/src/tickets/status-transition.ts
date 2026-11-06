import { ticketStatusLabel, type TicketStatus } from '@nexo/contracts';
import type { Prisma } from '../generated/prisma/client.js';

const activeStatuses: readonly string[] = ['open', 'waiting_for_analyst', 'in_progress'];

export async function transitionTicket(
  tx: Prisma.TransactionClient,
  ticketId: string,
  next: TicketStatus,
  now: Date,
): Promise<boolean> {
  const ticket = await tx.ticket.findUnique({
    where: { id: ticketId },
    select: { status: true },
  });
  if (!ticket) return false;
  const current = ticket.status as TicketStatus;
  if (current === next || !activeStatuses.includes(current)) return false;
  await tx.ticket.update({
    where: { id: ticketId },
    data: {
      status: next,
      resolvedAt: next === 'approved' || next === 'resolved' ? now : null,
    },
  });
  await tx.ticketEvent.create({
    data: {
      ticketId,
      kind: 'status_changed',
      content: `${ticketStatusLabel(current)} → ${ticketStatusLabel(next)}`,
      createdAt: now,
    },
  });
  return true;
}
