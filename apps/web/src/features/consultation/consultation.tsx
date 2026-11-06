'use client';
import {
  CONVERSATION_MESSAGE_LIMIT,
  SessionLimitResponseSchema,
  type ConsultationAction,
  type ConversationView,
  type MessageView,
} from '@nexo/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { readConsultationStream } from './stream';
import { Decision } from './decision';
import { DraftCard } from './draft-card';
import { TicketCard } from './ticket-card';
import { TicketSelection } from './ticket-selection';
import { employeeStage } from './stage';
const errors: Record<string, string> = {
  quota: 'O limite do modelo foi atingido. Tente novamente mais tarde.',
  model_unavailable: 'O assistente está indisponível. Tente novamente.',
  invalid_output: 'Não foi possível validar a resposta. Tente novamente.',
  interrupted: 'A resposta foi interrompida. Tente novamente.',
};
export function Consultation({
  conversationId,
  conversation,
  messages,
  setMessages,
  onBusy,
  onUnauthorized,
  onStartNew,
  onPausedState,
}: {
  conversationId: string;
  conversation: ConversationView;
  messages: MessageView[];
  setMessages: React.Dispatch<React.SetStateAction<MessageView[]>>;
  onBusy: (busy: boolean) => void;
  onUnauthorized: () => void;
  onStartNew: () => void;
  onPausedState?: (state: 'waiting_for_analyst' | 'with_analyst' | null) => void;
}): React.JSX.Element {
  const [content, setContent] = useState('');
  const [active, setActive] = useState(false);
  const [partial, setPartial] = useState('');
  const [actions, setActions] = useState<ConsultationAction[]>([]);
  const [error, setError] = useState('');
  const activeRef = useRef(false);
  const [serverUsed, setServerUsed] = useState(0);
  const [pendingDrafts, setPendingDrafts] = useState<string[]>([]);
  const [humanEngaged, setHumanEngaged] = useState(employeeStage(conversation.state) === 'human');
  const closed = conversation.state === 'closed';
  const now = new Date();
  const [handoff, setHandoff] = useState(conversation.handoff);
  const pausedState = humanEngaged
    ? conversation.state === 'with_analyst'
      ? ('with_analyst' as const)
      : ('waiting_for_analyst' as const)
    : null;
  useEffect(() => {
    onPausedState?.(pausedState);
  }, [onPausedState, pausedState]);
  useEffect(() => {
    let current = true;
    void fetch(`/api/conversations/${encodeURIComponent(conversationId)}/draft-proposals`)
      .then(async (response) => {
        if (response.status === 401) {
          onUnauthorized();
          return;
        }
        if (!response.ok) throw new Error();
        const result: unknown = await response.json();
        if (
          !Array.isArray(result) ||
          !result.every(
            (item: unknown) =>
              typeof item === 'object' &&
              item !== null &&
              'draftId' in item &&
              typeof item.draftId === 'string',
          )
        )
          throw new Error();
        if (current) setPendingDrafts(result.map((item: { draftId: string }) => item.draftId));
      })
      .catch(() => {
        if (current) setError('Não foi possível recuperar os rascunhos pendentes.');
      });
    return () => {
      current = false;
    };
  }, [conversationId, messages.length, onUnauthorized]);
  const used = Math.max(
    serverUsed,
    messages.filter((message) => message.role === 'employee').length,
  );
  const capped = used >= CONVERSATION_MESSAGE_LIMIT;
  async function send(value: string): Promise<void> {
    const text = value.trim();
    if (!text || activeRef.current || capped || closed) return;
    activeRef.current = true;
    setActive(true);
    onBusy(true);
    setError('');
    setPartial('');
    setActions([]);
    setContent('');
    let done = false;
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages/stream`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (response.status === 401) {
        onUnauthorized();
        throw new Error();
      }
      if (response.status === 409) {
        const limit = SessionLimitResponseSchema.safeParse(await response.json().catch(() => null));
        if (limit.success) {
          setServerUsed(limit.data.used);
          return;
        }
      }
      if (!response.ok || !response.body) throw new Error();
      await readConsultationStream(response.body, (event) => {
        if (event.type === 'user-message') setMessages((current) => [...current, event.message]);
        else if (event.type === 'text-delta') setPartial((current) => current + event.text);
        else if (event.type === 'action') setActions((current) => [...current, event.action]);
        else if (event.type === 'handoff-waiting') {
          done = true;
          setHumanEngaged(true);
          setPartial('');
          setActions([]);
        } else if (event.type === 'error') {
          setActions([]);
          setError(errors[event.code] ?? 'Não foi possível concluir a resposta.');
        } else if (event.type === 'done') {
          done = true;
          setMessages((current) => [...current, event.message]);
          setPartial('');
          setActions([]);
        }
      });
      if (!done) throw new Error();
    } catch {
      setError(
        'Não foi possível concluir a resposta. Recarregue a conversa para verificar o histórico.',
      );
    } finally {
      activeRef.current = false;
      setActive(false);
      onBusy(false);
    }
  }
  async function requestHandoff(): Promise<void> {
    if (active || humanEngaged) return;
    setError('');
    const response = await fetch(`/api/conversations/${conversationId}/handoff`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'employee_request' }),
    });
    if (response.status === 401) return onUnauthorized();
    if (!response.ok) return setError('Não foi possível solicitar atendimento humano.');
    const result = await response.json();
    setHumanEngaged(true);
    setHandoff(result.handoff);
  }
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void send(content);
  }
  async function selectTicket(ticket: { id: string; title: string }): Promise<void> {
    const response = await fetch(`/api/conversations/${conversationId}/ticket-selection`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: ticket.id }),
    });
    if (response.status === 401) return onUnauthorized();
    if (!response.ok) return setError('Não foi possível selecionar o chamado.');
    await send(ticket.title);
  }
  function chips(items: ConsultationAction[]) {
    return (
      <div className="consultation-actions">
        {items.map((action) => (
          <span className={action.status} key={action.id}>
            {action.status === 'succeeded' ? '✓' : '×'} {action.label}
          </span>
        ))}
      </div>
    );
  }
  return (
    <section className="consultation" aria-label="Conversa">
      <h2 className="visually-hidden">Mensagens</h2>
      {humanEngaged && (
        <p role="status">
          Aguardando atendimento humano. {handoff?.summary ?? 'Sua solicitação foi encaminhada.'}
        </p>
      )}
      {!humanEngaged && !closed && (error || capped || messages.at(-1)?.status === 'failed') && (
        <button
          className="human-support-button"
          type="button"
          disabled={active}
          onClick={() => void requestHandoff()}
        >
          Falar com um analista
        </button>
      )}
      {closed && (
        <>
          <p role="status">Atendimento encerrado.</p>
          <button type="button" disabled={active} onClick={onStartNew}>
            Nova conversa
          </button>
        </>
      )}
      {messages.length === 0 && !active && (
        <p className="consultation-empty">Descreva sua dúvida de TI para começar.</p>
      )}
      <div className="consultation-messages">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`chat-message ${message.role}`}
            aria-label={
              message.role === 'employee'
                ? 'Você'
                : message.role === 'agent'
                  ? 'Nexo Assist'
                  : `Suporte: ${message.authorName ?? 'Suporte'}`
            }
          >
            {message.role === 'employee' && <strong className="chat-message-speaker">Você</strong>}
            {message.role === 'agent' && (
              <div className="chat-message-status-line">
                <strong className="chat-message-speaker">Nexo Assist</strong>
                {message.status === 'completed' &&
                  message.decision &&
                  chips(message.decision.actions)}
              </div>
            )}
            {message.role === 'analyst' && (
              <>
                <strong className="chat-message-speaker">{message.authorName ?? 'Suporte'}</strong>
                <span className="support-tag">Suporte</span>
              </>
            )}
            {message.role === 'agent' &&
              message.status === 'completed' &&
              message.decision?.tickets.length === 1 && (
                <TicketCard ticket={message.decision.tickets[0]!} now={now} />
              )}
            <div className="chat-message-bubble">
              <p>{message.content}</p>
              {message.status === 'completed' &&
                message.decision &&
                message.decision.action !== 'handoff' &&
                !humanEngaged &&
                (message.decision.quickReplies.length > 0 ||
                  (message.decision.tickets.length === 1 && !closed)) && (
                  <div className="quick-replies">
                    {message.decision.quickReplies.map((reply) => (
                      <button
                        type="button"
                        disabled={active || capped}
                        key={reply}
                        onClick={() =>
                          void (/falar com (um )?analista/i.test(reply)
                            ? requestHandoff()
                            : send(reply))
                        }
                      >
                        {reply}
                      </button>
                    ))}
                    {message.decision.tickets.length === 1 &&
                      !closed &&
                      !message.decision.quickReplies.some((reply) =>
                        /falar com (um )?analista/i.test(reply),
                      ) && (
                        <button
                          type="button"
                          disabled={active}
                          onClick={() => void requestHandoff()}
                        >
                          Falar com um analista
                        </button>
                      )}
                  </div>
                )}
            </div>
            {message.status === 'failed' && (
              <p role="alert">
                {errors[message.decision?.errorCode ?? ''] ??
                  'Não foi possível concluir a resposta.'}
              </p>
            )}
            {message.decision && (
              <>
                {message.status === 'completed' &&
                  message.decision.action !== 'handoff' &&
                  !humanEngaged &&
                  message.decision.tickets.length > 1 && (
                    <TicketSelection
                      tickets={message.decision.tickets}
                      disabled={active || capped}
                      onSelect={(ticket) => void selectTicket(ticket)}
                    />
                  )}
                <Decision decision={message.decision} />
              </>
            )}
            {message.decision?.draftId && (
              <DraftCard draftId={message.decision.draftId} onUnauthorized={onUnauthorized} />
            )}
          </article>
        ))}
        {active && (
          <article className="chat-message agent" aria-label="Nexo Assist" aria-live="polite">
            <div className="chat-message-status-line">
              <strong className="chat-message-speaker">Nexo Assist</strong>
              {chips(actions)}
            </div>
            <div className="chat-message-bubble">
              <p>{partial || 'Preparando resposta...'}</p>
            </div>
          </article>
        )}
        {pendingDrafts
          .filter((id) => !messages.some((message) => message.decision?.draftId === id))
          .map((id) => (
            <DraftCard key={id} draftId={id} onUnauthorized={onUnauthorized} />
          ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {capped && (
        <>
          <p role="status">
            Você atingiu o limite de 30 mensagens nesta conversa. Inicie uma nova conversa para
            continuar.
          </p>
          <button type="button" disabled={active} onClick={onStartNew}>
            Nova conversa
          </button>
        </>
      )}
      {!closed && (
        <form className="consultation-composer" onSubmit={submit}>
          <label htmlFor="message">Mensagem</label>
          <div className="composer-row">
            <textarea
              id="message"
              name="content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={active || capped}
              required
              maxLength={4000}
              placeholder="Escreva para o Nexo..."
            />
            <button className="composer-send" disabled={active || capped} type="submit">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 19V5" />
                <path d="m6 11 6-6 6 6" />
              </svg>
              Enviar
            </button>
          </div>
        </form>
      )}
      <p className="message-counter">
        {used}/{CONVERSATION_MESSAGE_LIMIT} mensagens nesta sessão
      </p>
    </section>
  );
}
