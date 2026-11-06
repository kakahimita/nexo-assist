'use client';

import type { SupportConversationFilter, SupportConversationSummary } from '@nexo/contracts';
import { useState } from 'react';

import { getEmployeeInitials } from '../history/employee-initials';
import { formatFullDateTime, formatQueueTime, supportAvatarTone } from './support-visuals';

const filters: Array<{ value: SupportConversationFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'waiting', label: 'Para você' },
  { value: 'owned', label: 'Minhas' },
];

export const stateLabels = {
  agent: 'Com o agente',
  waiting_for_analyst: 'Aguardando atendente',
  with_analyst: 'Em atendimento',
  closed: 'Encerrada',
};

export const reasonLabels = {
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
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const visibleItems = normalizedQuery
    ? items.filter((item) =>
        [item.employee.name, item.lastMessage?.content ?? ''].some((value) =>
          value.toLocaleLowerCase('pt-BR').includes(normalizedQuery),
        ),
      )
    : items;

  return (
    <section aria-label="Conversas" className="support-list">
      <header className="support-list-header">
        <h2>Conversas</h2>
      </header>
      <label className="support-search">
        <span className="visually-hidden">Pesquisar conversas</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar conversa ou chamado"
        />
      </label>
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
        <div role="alert" className="support-list-alert">
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      )}
      {status === 'ready' && items.length === 0 && <p>Nenhuma conversa neste filtro.</p>}
      {status === 'ready' && items.length > 0 && visibleItems.length === 0 && (
        <p>Nenhuma conversa encontrada.</p>
      )}
      {status === 'ready' && visibleItems.length > 0 && (
        <ul>
          {visibleItems.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="support-queue-card"
                data-conversation-id={item.id}
                aria-current={selectedId === item.id ? 'true' : undefined}
                disabled={busy}
                onClick={() => onSelect(item.id)}
              >
                <span
                  aria-hidden="true"
                  className={`support-queue-avatar support-tone-${supportAvatarTone(item.employee.name)}`}
                >
                  {getEmployeeInitials(item.employee.name)}
                </span>
                <span className="support-queue-content">
                  <span className="support-queue-top">
                    <strong className="support-queue-name">{item.employee.name}</strong>
                    {item.lastMessage && (
                      <time className="support-queue-time" dateTime={item.lastMessage.createdAt}>
                        <span className="visually-hidden">
                          {formatFullDateTime(item.lastMessage.createdAt)}
                        </span>
                        <span aria-hidden="true">
                          {formatQueueTime(item.lastMessage.createdAt)}
                        </span>
                      </time>
                    )}
                  </span>
                  <span className="support-queue-preview">
                    {item.lastMessage?.content ?? 'Sem mensagens.'}
                  </span>
                  <span className="support-queue-status" data-state={item.state}>
                    <span aria-hidden="true" className="support-queue-dot" />
                    <span className="support-queue-state">{stateLabels[item.state]}</span>
                    {item.handoff && (
                      <span className="support-queue-reason">
                        {reasonLabels[item.handoff.reason]}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
