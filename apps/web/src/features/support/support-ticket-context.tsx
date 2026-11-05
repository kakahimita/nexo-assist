import type { TicketView } from '@nexo/contracts';
import { categories, priorities, ticketStatusLabel } from '../tickets/labels';

export function SupportTicketContext({
  tickets,
  employeeName,
}: {
  tickets: TicketView[];
  employeeName: string;
}): React.JSX.Element {
  return (
    <section aria-label={`Chamados de ${employeeName}`} className="support-ticket-context">
      <h2>Chamados de {employeeName}</h2>
      {tickets.length === 0 ? (
        <p>Nenhum chamado.</p>
      ) : (
        <ul>
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              {ticket.number && (
                <span className="support-ticket-number">{ticket.number}</span>
              )}
              <strong>{ticket.title}</strong>
              <span>
                {categories[ticket.category]} · prioridade {priorities[ticket.priority]}
              </span>
              <span>
                {ticketStatusLabel(ticket.status)} · prazo{' '}
                <time dateTime={ticket.deadline}>
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'America/Sao_Paulo',
                  }).format(new Date(ticket.deadline))}
                </time>
                {ticket.overdue ? ' · Atrasado' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
