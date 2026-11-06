import type { HandoffView, TicketView } from '@nexo/contracts';

import { categories, priorities, ticketStatusLabel } from '../tickets/labels';
import { formatFullDateTime } from './support-visuals';

function TicketMeta({ ticket }: { ticket: TicketView }): React.JSX.Element {
  return (
    <span className="support-ticket-detail">
      {categories[ticket.category]} · prioridade {priorities[ticket.priority]}
      {ticket.overdue ? ' · Atrasado' : ''}
      <span className="visually-hidden">
        {' '}
        · {ticketStatusLabel(ticket.status)} · prazo{' '}
        <time dateTime={ticket.deadline}>{formatFullDateTime(ticket.deadline)}</time>
      </span>
    </span>
  );
}

function CurrentTicket({
  ticket,
  handoff,
}: {
  ticket: TicketView;
  handoff: HandoffView | null;
}): React.JSX.Element {
  return (
    <article className="support-ticket-card">
      <div className="support-ticket-card-top">
        {ticket.number && <span className="support-ticket-number">{ticket.number}</span>}
        <span className="support-ticket-status" data-status={ticket.status}>
          {ticketStatusLabel(ticket.status)}
        </span>
      </div>
      <strong className="support-ticket-title">{ticket.title}</strong>
      <TicketMeta ticket={ticket} />
      <div className="support-ticket-event">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m17 3 4 4-4 4" />
          <path d="M3 7h18" />
          <path d="m7 21-4-4 4-4" />
          <path d="M21 17H3" />
        </svg>
        <span>{handoff ? 'Transferido para um analista' : 'Chamado vinculado à conversa'}</span>
        {handoff && (
          <time dateTime={handoff.requestedAt}>{formatFullDateTime(handoff.requestedAt)}</time>
        )}
      </div>
    </article>
  );
}

function OtherTicket({ ticket }: { ticket: TicketView }): React.JSX.Element {
  return (
    <li className="support-ticket-other" data-status={ticket.status}>
      <span aria-hidden="true" className="support-ticket-dot" data-status={ticket.status} />
      <div className="support-ticket-other-text">
        <strong>{ticket.title}</strong>
        <span>
          {ticket.number ? `${ticket.number} · ` : ''}
          {ticketStatusLabel(ticket.status)}
        </span>
        <TicketMeta ticket={ticket} />
      </div>
    </li>
  );
}

export function SupportTicketContext({
  tickets,
  employeeName,
  contextTicketId,
  handoff,
}: {
  tickets: TicketView[];
  employeeName: string;
  contextTicketId: string | null;
  handoff: HandoffView | null;
}): React.JSX.Element {
  const linked = tickets.find((ticket) => ticket.id === contextTicketId) ?? null;
  const others = tickets.filter((ticket) => ticket.id !== contextTicketId);
  const openCount = tickets.filter((ticket) => ticket.status !== 'resolved').length;
  const closedCount = tickets.length - openCount;
  const shortName = employeeName.trim().split(/\s+/)[0] ?? employeeName;

  return (
    <section aria-label={`Chamados de ${employeeName}`} className="support-ticket-context">
      <header className="support-ticket-header">
        <div>
          <h2>Chamados da {shortName}</h2>
          <span className="support-ticket-meta">
            {openCount} abertos · {closedCount} encerrados
          </span>
        </div>
      </header>
      <div className="support-ticket-body">
        {tickets.length === 0 ? (
          <p>Nenhum chamado.</p>
        ) : (
          <>
            {linked && (
              <section aria-label="Desta conversa" className="support-ticket-section">
                <h3>Desta conversa</h3>
                <CurrentTicket ticket={linked} handoff={handoff} />
              </section>
            )}
            {others.length > 0 && (
              <section aria-label="Outros chamados" className="support-ticket-section">
                <h3>Outros chamados</h3>
                <ul className="support-ticket-others">
                  {others.map((ticket) => (
                    <OtherTicket ticket={ticket} key={ticket.id} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </section>
  );
}
