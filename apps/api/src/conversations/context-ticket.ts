import type { ConsultationTicketView, TicketStatus } from '@nexo/contracts';

const activeStatuses: TicketStatus[] = ['open', 'waiting_for_analyst', 'in_progress'];

export function resolveContextTicketId(input: {
  explicit: string | null;
  decided: ConsultationTicketView[];
  existing: string | null;
}): string | null {
  if (input.explicit) return input.explicit;
  const active = input.decided.filter((ticket) => activeStatuses.includes(ticket.status));
  if (active.length === 1) return active[0]!.id;
  return input.existing;
}
