'use client';
import {
  SupportConversationViewSchema,
  type SupportConversationFilter,
  type SupportConversationView,
} from '@nexo/contracts';
import { useCallback, useState, type FormEvent } from 'react';
import { SupportQueue } from './support-queue';
import { useSupportQueue } from './use-support-queue';

export function Support({ onLogout }: { onLogout: () => void }): React.JSX.Element {
  const [filter, setFilter] = useState<SupportConversationFilter>('waiting');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<SupportConversationView | null>(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const {
    items: queue,
    status: queueStatus,
    error: queueError,
    reload: loadQueue,
  } = useSupportQueue(filter, onLogout);

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
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <SupportQueue
        items={queue}
        filter={filter}
        selectedId={selectedId}
        status={queueStatus}
        error={queueError}
        onFilterChange={setFilter}
        onSelect={(id) => void select(id)}
        onRetry={() => void loadQueue()}
      />
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
