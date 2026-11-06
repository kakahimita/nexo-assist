'use client';
import type { ConsultationTicketView } from '@nexo/contracts';
import { categories, priorities, ticketStatusLabel } from '../tickets/labels';
import { formatCreatedAt, formatDeadline, formatElapsed } from './ticket-card-format';

export function TicketCard({
  ticket,
  now,
}: {
  ticket: ConsultationTicketView;
  now: Date;
}): React.JSX.Element {
  return (
    <article
      className="ticket-card consultation-ticket-card"
      aria-label={`Chamado ${ticket.title}`}
    >
      <div className="consultation-ticket-heading">
        <span className="consultation-ticket-identity">
          <span className="consultation-ticket-kind">Chamado</span>
          {ticket.number && <span className="consultation-ticket-number">{ticket.number}</span>}
        </span>
        <span className={`consultation-ticket-status ${ticket.status}`}>
          {ticketStatusLabel(ticket.status)}
        </span>
      </div>
      <h3>{ticket.title}</h3>
      {ticket.description && (
        <p className="consultation-ticket-description">{ticket.description}</p>
      )}
      <div className="consultation-ticket-meta">
        <p>
          <span className="consultation-ticket-label">Categoria:</span>{' '}
          {ticket.category ? categories[ticket.category] : '—'}
        </p>
        <p>
          <span className="consultation-ticket-label">Prioridade:</span>{' '}
          {priorities[ticket.priority]}
        </p>
        <p>
          <span className="consultation-ticket-label">Aberto em:</span>{' '}
          {ticket.createdAt ? (
            <time dateTime={ticket.createdAt}>{formatCreatedAt(ticket.createdAt)}</time>
          ) : (
            '—'
          )}
        </p>
        <p>
          <span className="consultation-ticket-label">Última atualização:</span>{' '}
          <span className="consultation-ticket-update-value">
            {formatElapsed(ticket.lastUpdate, now)}
          </span>
        </p>
      </div>
      <p className="consultation-ticket-deadline">
        <span className="consultation-ticket-label">Prazo:</span> {formatDeadline(ticket.deadline)}
        {ticket.overdue && <strong> · Prazo vencido</strong>}
      </p>
    </article>
  );
}
