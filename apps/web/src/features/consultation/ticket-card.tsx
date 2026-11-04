'use client';
import type { ConsultationTicketView } from '@nexo/contracts';
import { priorities, ticketStatusLabel } from '../tickets/labels';
import { formatDeadline, formatElapsed } from './ticket-card-format';

export function TicketCard({
  ticket,
  now,
}: {
  ticket: ConsultationTicketView;
  now: Date;
}): React.JSX.Element {
  return (
    <article className="ticket-card" aria-label={`Chamado ${ticket.title}`}>
      <h3>{ticket.title}</h3>
      <p>
        Situação: {ticketStatusLabel(ticket.status)} · Prioridade: {priorities[ticket.priority]}
      </p>
      <p>
        Prazo: {formatDeadline(ticket.deadline)}
        {ticket.overdue && <strong> · Prazo vencido</strong>}
      </p>
      <p>Última atualização: {formatElapsed(ticket.lastUpdate, now)}</p>
    </article>
  );
}
