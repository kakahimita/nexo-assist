'use client';

import type { SupportConversationFilter, SupportConversationSummary } from '@nexo/contracts';

const filters: Array<{ value: SupportConversationFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'waiting', label: 'Para você' },
  { value: 'owned', label: 'Minhas' },
];

const stateLabels = {
  agent: 'Com o agente',
  waiting_for_analyst: 'Aguardando atendente',
  with_analyst: 'Em atendimento',
  closed: 'Encerrada',
};

const reasonLabels = {
  employee_request: 'Transferida',
  critical_incident: 'Incidente crítico',
  overdue_ticket: 'Chamado vencido',
  unresolved_uncertainty: 'Sem segurança',
};

export function SupportQueue({
  items,
  filter,
  selectedId,
  status,
  error,
  busy,
  onFilterChange,
  onSelect,
  onRetry,
}: {
  items: SupportConversationSummary[];
  filter: SupportConversationFilter;
  selectedId: string;
  status: 'loading' | 'ready' | 'error';
  error: string;
  busy: boolean;
  onFilterChange: (filter: SupportConversationFilter) => void;
  onSelect: (id: string) => void;
  onRetry: () => void;
}): React.JSX.Element {
  return (
    <section aria-label="Conversas" className="support-list">
      <h2>Conversas</h2>
      <nav aria-label="Filtros" className="support-filters">
        {filters.map(({ value, label }) => (
          <button
            type="button"
            key={value}
            aria-pressed={filter === value}
            disabled={busy}
            onClick={() => onFilterChange(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {status === 'loading' && <p role="status">Carregando conversas…</p>}
      {status === 'error' && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      )}
      {status === 'ready' && items.length === 0 && <p>Nenhuma conversa neste filtro.</p>}
      {status === 'ready' && (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                data-conversation-id={item.id}
                aria-current={selectedId === item.id ? 'true' : undefined}
                disabled={busy}
                onClick={() => onSelect(item.id)}
              >
                <span aria-hidden="true" className="support-queue-initials">
                  {item.employee.name.slice(0, 2).toUpperCase()}
                </span>
                <strong className="support-queue-name">{item.employee.name}</strong>
                <span className="support-queue-preview">
                  {item.lastMessage?.content ?? 'Sem mensagens.'}
                </span>
                <span className="support-queue-state">{stateLabels[item.state]}</span>
                {item.handoff && (
                  <span className="support-queue-reason">{reasonLabels[item.handoff.reason]}</span>
                )}
                {item.lastMessage && (
                  <time className="support-queue-time" dateTime={item.lastMessage.createdAt}>
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                      timeZone: 'America/Sao_Paulo',
                    }).format(new Date(item.lastMessage.createdAt))}
                  </time>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
