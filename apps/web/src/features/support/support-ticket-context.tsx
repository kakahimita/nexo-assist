import type { TicketView } from '@nexo/contracts';
import { categories, priorities, ticketStatusLabel } from '../tickets/labels';

function TicketItem({ ticket }: { ticket: TicketView }): React.JSX.Element {
  return (
    <li>
      {ticket.number && <span className="support-ticket-number">{ticket.number}</span>}
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
  );
}

export function SupportTicketContext({
  tickets,
  employeeName,
  contextTicketId,
}: {
  tickets: TicketView[];
  employeeName: string;
  contextTicketId: string | null;
}): React.JSX.Element {
  const linked = tickets.find((ticket) => ticket.id === contextTicketId) ?? null;
  const others = tickets.filter((ticket) => ticket.id !== contextTicketId);
  return (
    <section aria-label={`Chamados de ${employeeName}`} className="support-ticket-context">
      <h2>Chamados de {employeeName}</h2>
      {tickets.length === 0 ? (
        <p>Nenhum chamado.</p>
      ) : (
        <>
          {linked && (
            <section aria-label="Desta conversa">
              <h3>Desta conversa</h3>
              <ul>
                <TicketItem ticket={linked} />
              </ul>
            </section>
          )}
          {others.length > 0 && (
            <section aria-label="Outros chamados">
              <h3>Outros chamados</h3>
              <ul>
                {others.map((ticket) => (
                  <TicketItem ticket={ticket} key={ticket.id} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}
