'use client';
import {
  ConversationViewSchema,
  MessageViewSchema,
  type ConversationView,
  type MessageView,
  type UserView,
} from '@nexo/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Tickets } from '../tickets/tickets';
import { Consultation } from '../consultation/consultation';
import { Support } from '../support/support';

export function History({
  user,
  onLogout,
}: {
  user: UserView;
  onLogout: () => void;
}): React.JSX.Element {
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticketsVersion, setTicketsVersion] = useState(0);
  const [page, setPage] = useState<'support' | 'profile'>('support');
  const busyRef = useRef(false);
  const selectionVersion = useRef(0);
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
  const load = useCallback(async () => {
    try {
      const data: unknown = await (await call('/api/conversations')).json();
      if (!Array.isArray(data)) throw new Error();
      setConversations(data.map((item: unknown) => ConversationViewSchema.parse(item)));
    } catch {
      setError('Não foi possível carregar o histórico.');
    }
  }, [call]);
  useEffect(() => {
    if (user.role === 'employee') void Promise.resolve().then(load);
  }, [load, user.role]);
  async function choose(id: string) {
    const version = ++selectionVersion.current;
    try {
      const data: unknown = await (await call(`/api/conversations/${id}/messages`)).json();
      if (!Array.isArray(data)) throw new Error();
      if (version !== selectionVersion.current) return;
      setMessages(data.map((item: unknown) => MessageViewSchema.parse(item)));
      setSelected(id);
      setError('');
    } catch {
      if (version === selectionVersion.current) setError('Não foi possível carregar a conversa.');
    }
  }
  async function create() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const data = ConversationViewSchema.parse(
        await (
          await call('/api/conversations', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          })
        ).json(),
      );
      await load();
      await choose(data.id);
    } catch {
      setError('Não foi possível criar a conversa.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await call('/api/session', { method: 'DELETE' });
      onLogout();
    } catch {
      setError('Não foi possível sair. Tente novamente.');
    }
  }
  return (
    <main className="history">
      <header>
        <h1>Nexo Assist</h1>
        <p>Olá, {user.name}</p>
        <button disabled={busy} onClick={() => void logout()}>
          Sair
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {user.role === 'analyst' ? (
        <Support onLogout={onLogout} />
      ) : (
        <>
          <nav aria-label="Navegação principal" className="profile-navigation">
            <button
              type="button"
              aria-current={page === 'support' ? 'page' : undefined}
              onClick={() => setPage('support')}
            >
              Atendimento
            </button>
            <button
              type="button"
              aria-current={page === 'profile' ? 'page' : undefined}
              onClick={() => setPage('profile')}
            >
              Meu perfil
            </button>
          </nav>
          {page === 'profile' && (
            <section className="profile" aria-labelledby="profile-heading">
              <h2 id="profile-heading">Meu perfil</h2>
              <p>Seus dados de acesso ao service desk de TI.</p>
              <dl className="profile-card">
                <div>
                  <dt>Nome</dt>
                  <dd>{user.name}</dd>
                </div>
                <div>
                  <dt>E-mail corporativo</dt>
                  <dd>{user.email}</dd>
                </div>
              </dl>
            </section>
          )}
          <div hidden={page !== 'support'}>
            <p>As mensagens são salvas no histórico.</p>
            <button disabled={busy} onClick={() => void create()}>
              Nova conversa
            </button>
            <nav aria-label="Conversas">
              {conversations.length === 0 && <p>Nenhuma conversa ainda.</p>}
              {conversations.map((item, index) => (
                <button disabled={busy} key={item.id} onClick={() => void choose(item.id)}>
                  Conversa {index + 1}
                </button>
              ))}
            </nav>
            {selected && (
              <Consultation
                key={selected}
                conversationId={selected}
                conversation={conversations.find((item) => item.id === selected)!}
                messages={messages}
                setMessages={setMessages}
                onUnauthorized={onLogout}
                onStartNew={() => void create()}
                onTicketCommitted={() => setTicketsVersion((value) => value + 1)}
                onBusy={(value) => {
                  busyRef.current = value;
                  setBusy(value);
                }}
              />
            )}
            <Tickets onUnauthorized={onLogout} reloadToken={ticketsVersion} />
          </div>
        </>
      )}
    </main>
  );
}
