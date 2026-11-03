'use client';
import {
  SupportConversationSummarySchema,
  SupportConversationViewSchema,
  type SupportConversationSummary,
  type SupportConversationView,
} from '@nexo/contracts';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

const reasonTag: Record<string, string> = {
  employee_request: 'Transferida',
  critical_incident: 'Incidente crítico',
  overdue_ticket: 'Chamado vencido',
  unresolved_uncertainty: 'Sem segurança',
};

export function Support({ onLogout }: { onLogout: () => void }): React.JSX.Element {
  const [filter, setFilter] = useState<'all' | 'waiting' | 'owned'>('waiting');
  const [queue, setQueue] = useState<SupportConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<SupportConversationView | null>(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const call = useCallback(
    async (url: string, options?: RequestInit) => {
      const response = await fetch(url, options);
      if (response.status === 401) {
        onLogout();
        throw new Error();
      }
      if (!response.ok) throw new Error();
      return response;
    },
    [onLogout],
  );

  const loadQueue = useCallback(async () => {
    try {
      const data: unknown = await (
        await call(`/api/support/conversations?filter=${filter}`)
      ).json();
      if (!Array.isArray(data)) throw new Error();
      setQueue(data.map((item: unknown) => SupportConversationSummarySchema.parse(item)));
    } catch {
      setError('Não foi possível carregar as conversas.');
    }
  }, [call, filter]);

  useEffect(() => {
    void Promise.resolve().then(loadQueue);
  }, [loadQueue]);

  async function select(id: string) {
    setSelectedId(id);
    setNotice('');
    setError('');
    try {
      const data: unknown = await (await call(`/api/support/conversations/${id}`)).json();
      setDetail(SupportConversationViewSchema.parse(data));
    } catch {
      setError('Não foi possível carregar a conversa.');
    }
  }

  async function act(path: string, body: string) {
    if (busy) return;
    setBusy(true);
    try {
      await call(`/api/support/conversations/${selectedId}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
    } catch {
      setError('Não foi possível concluir a ação.');
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    await act('claim', '{}');
    await select(selectedId);
    await loadQueue();
  }

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = content.trim();
    if (!text || busy) return;
    setContent('');
    await act('reply', JSON.stringify({ content: text }));
    await select(selectedId);
  }

  async function returnToAgent() {
    await act('return', '{}');
    setDetail(null);
    setSelectedId('');
    await loadQueue();
  }

  async function close() {
    await act('close', '{}');
    setNotice('Atendimento encerrado.');
    setDetail(null);
    setSelectedId('');
    await loadQueue();
  }

  const owned = detail?.conversation.state === 'with_analyst';

  return (
    <div className="support">
      <nav aria-label="Filtros" className="support-filters">
        <button type="button" onClick={() => setFilter('all')}>
          Todas
        </button>
        <button type="button" onClick={() => setFilter('waiting')}>
          Para você
        </button>
        <button type="button" onClick={() => setFilter('owned')}>
          Minhas
        </button>
      </nav>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <section aria-label="Conversas" className="support-list">
        {queue.length === 0 && <p>Nenhuma conversa.</p>}
        {queue.map((item) => (
          <button
            type="button"
            key={item.id}
            data-conversation-id={item.id}
            onClick={() => void select(item.id)}
          >
            {item.employee.name}
            {item.handoff ? ` · ${reasonTag[item.handoff.reason] ?? 'Transferida'}` : ''}
          </button>
        ))}
      </section>
      {detail && (
        <section aria-label="Atendimento" className="support-detail">
          <header className="support-detail-header">
            <strong>{detail.conversation.employee.name}</strong>
            <span role="status">{owned ? 'Você está atendendo' : 'Aguardando atendente'}</span>
          </header>
          {!owned ? (
            <button type="button" disabled={busy} onClick={() => void claim()}>
              Assumir atendimento
            </button>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => void returnToAgent()}>
                Devolver ao agent
              </button>
              <button type="button" disabled={busy} onClick={() => void close()}>
                Encerrar atendimento
              </button>
            </>
          )}
          <div className="support-messages">
            {detail.messages.map((message) => (
              <p key={message.id}>
                {message.role === 'analyst' ? `${message.authorName ?? 'Suporte'}: ` : ''}
                {message.content}
              </p>
            ))}
          </div>
          <section aria-label={`Chamados de ${detail.conversation.employee.name}`}>
            <h2>Chamados de {detail.conversation.employee.name}</h2>
            {detail.tickets.length === 0 && <p>Nenhum chamado.</p>}
            {detail.tickets.map((ticket) => (
              <p key={ticket.id}>
                {ticket.title} · {ticket.status === 'open' ? 'Aberto' : 'Resolvido'} · prioridade{' '}
                {ticket.priority}
              </p>
            ))}
          </section>
          {!owned ? (
            <p>Assuma o atendimento para responder</p>
          ) : (
            <form onSubmit={reply}>
              <label htmlFor="reply">Resposta</label>
              <textarea
                id="reply"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                disabled={busy}
                required
              />
              <button type="submit" disabled={busy}>
                Enviar resposta
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
