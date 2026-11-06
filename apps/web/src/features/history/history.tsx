'use client';
import {
  ConversationViewSchema,
  MessageViewSchema,
  type ConversationView,
  type MessageView,
  type UserView,
} from '@nexo/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Consultation } from '../consultation/consultation';
import { Support } from '../support/support';
import { fetchApiReadiness, getApiBaseUrl } from '../system-status/api';
import { getEmployeeInitials } from './employee-initials';

const AVAILABILITY_TIMEOUT_MS = 5_000;

export function History({
  user,
  onLogout,
}: {
  user: UserView;
  onLogout: () => void;
}): React.JSX.Element {
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [selected, setSelected] = useState('');
  const [currentPaused, setCurrentPaused] = useState<'waiting_for_analyst' | 'with_analyst' | null>(
    null,
  );
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState<'support' | 'profile'>('support');
  const [availability, setAvailability] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [availabilityAttempt, setAvailabilityAttempt] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const busyRef = useRef(false);
  const loadVersion = useRef(0);
  const selectionVersion = useRef(0);
  useEffect(() => {
    if (user.role !== 'analyst') return;
    const controller = new AbortController();
    let running = false;
    const heartbeat = async () => {
      if (document.visibilityState !== 'visible' || running) return;
      running = true;
      try {
        await fetch('/api/session/presence', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]),
        });
      } catch {
        /* Presence expires without successful heartbeats. */
      } finally {
        running = false;
      }
    };
    void heartbeat();
    const interval = setInterval(() => void heartbeat(), 20_000);
    const visible = () => void heartbeat();
    document.addEventListener('visibilitychange', visible);
    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [user.role]);
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
  const load = useCallback(async (): Promise<ConversationView[] | null> => {
    const version = ++loadVersion.current;
    try {
      const data: unknown = await (await call('/api/conversations')).json();
      if (!Array.isArray(data)) throw new Error();
      const parsed = data.map((item: unknown) => ConversationViewSchema.parse(item));
      if (version === loadVersion.current) setConversations(parsed);
      return parsed;
    } catch {
      if (version === loadVersion.current) setError('Não foi possível carregar a conversa.');
      return null;
    }
  }, [call]);
  useEffect(() => {
    if (user.role !== 'employee') return;

    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AVAILABILITY_TIMEOUT_MS);

    void fetchApiReadiness(getApiBaseUrl(), controller.signal)
      .then(() => {
        if (active) setAvailability('ready');
      })
      .catch(() => {
        if (active) setAvailability('unavailable');
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [availabilityAttempt, user.role]);
  const choose = useCallback(
    async (id: string) => {
      const version = ++selectionVersion.current;
      try {
        const data: unknown = await (await call(`/api/conversations/${id}/messages`)).json();
        if (!Array.isArray(data)) throw new Error();
        if (version !== selectionVersion.current) return;
        setMessages(data.map((item: unknown) => MessageViewSchema.parse(item)));
        setSelected(id);
        setCurrentPaused(null);
        setError('');
      } catch {
        if (version === selectionVersion.current) setError('Não foi possível carregar a conversa.');
      }
    },
    [call],
  );
  const reportPaused = useCallback(
    (state: 'waiting_for_analyst' | 'with_analyst' | null) => {
      setCurrentPaused(state);
      if (!state) return;
      setConversations((current) =>
        current.map((item) => (item.id === selected ? { ...item, state } : item)),
      );
    },
    [selected],
  );
  const create = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    loadVersion.current++;
    selectionVersion.current++;
    setBusy(true);
    setCreating(true);
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
      setConversations((current) => [...current, data]);
      await choose(data.id);
    } catch {
      setError('Não foi possível criar a conversa.');
    } finally {
      busyRef.current = false;
      setBusy(false);
      setCreating(false);
    }
  }, [call, choose]);
  useEffect(() => {
    if (user.role !== 'employee') return;
    let current = true;
    const version = selectionVersion.current;
    void Promise.resolve()
      .then(load)
      .then((items) => {
        if (!current || version !== selectionVersion.current || items === null) return;
        if (items.length) void choose(items[items.length - 1]!.id);
        else void create();
      });
    return () => {
      current = false;
    };
  }, [choose, create, load, user.role]);
  async function logout() {
    try {
      await call('/api/session', { method: 'DELETE' });
      onLogout();
    } catch {
      setError('Não foi possível sair. Tente novamente.');
    }
  }
  if (user.role === 'analyst') {
    return (
      <div className="analyst-layout">
        <aside className="analyst-rail" aria-label="Navegação do suporte">
          <span className="analyst-logo" aria-label="Nexo Assist">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.763 2.245 18.389 3.932c-.623.308-.973.903-.973 1.631v6.293L6.223 2.427c-.623-.469-1.372-.553-2.03-.245L1.008 3.813C.357 4.135 0 4.737 0 5.486v15.218c0 1.477 1.526 2.289 2.716 1.785l3.073-1.617c.693-.322 1.057-.952 1.057-1.722v-7.7l11.732 10.591c.602.546 1.421.679 2.086.364l2.786-1.505c.602-.315.786-.931.786-1.68V3.932c0-1.463-1.505-2.275-2.625-1.687Z" />
            </svg>
          </span>
          <span
            className="analyst-rail-conversations"
            role="img"
            aria-label={`Conversas${queueCount > 0 ? `: ${queueCount}` : ''}`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-3A8.5 8.5 0 1 1 21 11.5Z" />
            </svg>
            {queueCount > 0 && <span className="analyst-badge">{queueCount}</span>}
          </span>
          <div className="analyst-account">
            <span className="analyst-avatar" aria-hidden="true">
              {getEmployeeInitials(user.name)}
            </span>
            <button type="button" disabled={busy} onClick={() => void logout()}>
              Sair
            </button>
          </div>
        </aside>
        <main className="analyst-main">
          {error && <p role="alert">{error}</p>}
          <Support user={user} onLogout={onLogout} onQueueCountChange={setQueueCount} />
        </main>
      </div>
    );
  }
  const currentConversation = conversations.find((item) => item.id === selected) ?? null;
  const pausedConversation =
    conversations
      .map((item) =>
        item.id === selected && currentPaused ? { ...item, state: currentPaused } : item,
      )
      .filter((item) => item.state === 'waiting_for_analyst' || item.state === 'with_analyst')
      .at(-1) ?? null;
  const selectedPaused =
    currentPaused !== null ||
    currentConversation?.state === 'waiting_for_analyst' ||
    currentConversation?.state === 'with_analyst';
  const otherPaused =
    pausedConversation && pausedConversation.id !== selected ? pausedConversation : null;
  return (
    <div className="employee-layout">
      <aside className="employee-sidebar">
        <div className="employee-brand">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.763 2.245 18.389 3.932c-.623.308-.973.903-.973 1.631v6.293L6.223 2.427c-.623-.469-1.372-.553-2.03-.245L1.008 3.813C.357 4.135 0 4.737 0 5.486v15.218c0 1.477 1.526 2.289 2.716 1.785l3.073-1.617c.693-.322 1.057-.952 1.057-1.722v-7.7l11.732 10.591c.602.546 1.421.679 2.086.364l2.786-1.505c.602-.315.786-.931.786-1.68V3.932c0-1.463-1.505-2.275-2.625-1.687Z" />
          </svg>{' '}
          Nexo Assist
        </div>
        <nav aria-label="Navegação principal" className="profile-navigation">
          <button
            type="button"
            aria-current={page === 'support' ? 'page' : undefined}
            onClick={() => setPage('support')}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 4h16v13H8l-4 3z" />
            </svg>{' '}
            Atendimento
          </button>
          <button
            type="button"
            aria-current={page === 'profile' ? 'page' : undefined}
            onClick={() => setPage('profile')}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
            </svg>{' '}
            Meu perfil
          </button>
        </nav>
        <div className="employee-account">
          <div className="employee-account-identity">
            <span aria-hidden="true" className="employee-avatar">
              {getEmployeeInitials(user.name)}
            </span>
            <p>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </p>
          </div>
          <button
            className="employee-logout"
            type="button"
            disabled={busy}
            onClick={() => void logout()}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            Sair
          </button>
        </div>
      </aside>
      <main className="employee-main">
        <header className="employee-topbar">
          <span>Service desk de TI</span>
          <span aria-hidden="true">›</span>
          <strong>{page === 'support' ? 'Atendimento' : 'Meu perfil'}</strong>
          <div
            className={`employee-availability employee-availability-${availability}`}
            role="status"
          >
            <span aria-hidden="true" className="employee-availability-dot" />
            {availability === 'loading' && <span>Verificando disponibilidade</span>}
            {availability === 'ready' && <span>Assistente online</span>}
            {availability === 'unavailable' && (
              <>
                <span>Assistente indisponível</span>
                <button
                  type="button"
                  onClick={() => {
                    setAvailability('loading');
                    setAvailabilityAttempt((attempt) => attempt + 1);
                  }}
                >
                  Tentar novamente
                </button>
              </>
            )}
          </div>
        </header>
        <div className="employee-content">
          {error && <p role="alert">{error}</p>}
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
              <section className="profile-security" aria-label="Senha">
                <div className="profile-security-main">
                  <span className="profile-security-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="15" cy="9" r="5" />
                      <path d="m11.5 12.5-8 8v-4l3-3 2 2 2-2" />
                    </svg>
                  </span>
                  <div>
                    <h3>Senha</h3>
                    <p>Gerenciada pela TI da Nexo</p>
                  </div>
                  <button type="button" disabled>
                    Redefinir senha
                  </button>
                </div>
                <p className="profile-security-note">
                  A redefinição de senha não está disponível nesta demonstração.
                </p>
              </section>
            </section>
          )}
          <div className="employee-chat-view" hidden={page !== 'support'}>
            {creating && <p role="status">Iniciando conversa...</p>}
            {selected && selectedPaused && currentConversation && (
              <div className="employee-paused-bar" role="status">
                <span>
                  {(currentPaused ?? currentConversation.state) === 'waiting_for_analyst'
                    ? 'Seu atendimento está aguardando um analista.'
                    : 'Seu atendimento está com um analista.'}
                </span>
                <button type="button" disabled={busy || creating} onClick={() => void create()}>
                  Iniciar nova conversa
                </button>
              </div>
            )}
            {selected && !selectedPaused && otherPaused && (
              <div className="employee-paused-bar" role="status">
                <span>
                  Você tem um atendimento{' '}
                  {otherPaused.state === 'waiting_for_analyst'
                    ? 'aguardando um analista'
                    : 'com um analista'}
                  .
                </span>
                <button
                  type="button"
                  disabled={busy || creating}
                  onClick={() => void choose(otherPaused.id)}
                >
                  Voltar ao atendimento
                </button>
              </div>
            )}
            {!creating && !selected && error && (
              <button type="button" onClick={() => void create()}>
                Tentar novamente
              </button>
            )}
            {selected && !creating && (
              <Consultation
                key={selected}
                conversationId={selected}
                conversation={conversations.find((item) => item.id === selected)!}
                messages={messages}
                setMessages={setMessages}
                onUnauthorized={onLogout}
                onStartNew={() => void create()}
                onPausedState={reportPaused}
                onBusy={(value) => {
                  busyRef.current = value;
                  setBusy(value);
                }}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
