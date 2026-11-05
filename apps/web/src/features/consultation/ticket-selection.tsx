'use client';

import type { ConsultationTicketView } from '@nexo/contracts';
import { useId, useState, type FormEvent } from 'react';
import { ticketStatusLabel } from '../tickets/labels';

export function TicketSelection({
  tickets,
  disabled,
  onSelect,
}: {
  tickets: ConsultationTicketView[];
  disabled: boolean;
  onSelect: (ticket: ConsultationTicketView) => void;
}): React.JSX.Element {
  const [selectedId, setSelectedId] = useState('');
  const groupName = useId();
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (disabled || selectedTicket === undefined) return;
    onSelect(selectedTicket);
  }

  return (
    <form className="ticket-selection" onSubmit={submit}>
      <fieldset disabled={disabled}>
        <legend>Chamados encontrados</legend>
        {tickets.map((ticket) => (
          <label key={ticket.id}>
            <input
              type="radio"
              name={groupName}
              value={ticket.id}
              checked={selectedId === ticket.id}
              onChange={() => setSelectedId(ticket.id)}
            />{' '}
            {ticket.title} · {ticketStatusLabel(ticket.status)}
            {ticket.overdue ? ' · prazo vencido' : ''}
          </label>
        ))}
      </fieldset>
      <button type="submit" disabled={disabled || selectedTicket === undefined}>
        Ver detalhes
      </button>
    </form>
  );
}
