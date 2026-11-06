'use client';

import type { ConsultationTicketView } from '@nexo/contracts';
import { useState } from 'react';
import { ticketStatusLabel } from '../tickets/labels';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

export function TicketSelection({
  tickets,
  disabled,
  onSelect,
}: {
  tickets: ConsultationTicketView[];
  disabled: boolean;
  onSelect: (ticket: ConsultationTicketView) => void;
}): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <div className="ticket-selection" role="group" aria-label="Chamados encontrados">
      {tickets.map((ticket) => (
        <button
          className={`ticket-selection-row${selectedId === ticket.id ? ' selected' : ''}`}
          type="button"
          aria-pressed={selectedId === ticket.id}
          disabled={disabled}
          key={ticket.id}
          onClick={() => {
            setSelectedId(ticket.id);
            onSelect(ticket);
          }}
        >
          <span className="ticket-selection-indicator" aria-hidden="true" />
          {ticket.number && <span className="ticket-selection-number">{ticket.number}</span>}
          <span className="ticket-selection-title">{ticket.title}</span>
          <span className={`ticket-selection-status ${ticket.overdue ? 'overdue' : ticket.status}`}>
            <span aria-hidden="true" />
            {ticketStatusLabel(ticket.status)}
            {ticket.overdue ? ' · prazo vencido' : ''}
          </span>
          {ticket.createdAt && (
            <time dateTime={ticket.createdAt} className="ticket-selection-date">
              {dateFormatter.format(new Date(ticket.createdAt))}
            </time>
          )}
        </button>
      ))}
    </div>
  );
}
