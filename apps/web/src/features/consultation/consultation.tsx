'use client';
import { CONVERSATION_MESSAGE_LIMIT, SessionLimitResponseSchema, type ConsultationAction, type MessageView } from '@nexo/contracts';
import { useRef, useState, type FormEvent } from 'react';
import { readConsultationStream } from './stream';
import { Decision } from './decision';
const errors: Record<string, string> = { quota: 'O limite do modelo foi atingido. Tente novamente mais tarde.', model_unavailable: 'O assistente está indisponível. Tente novamente.', invalid_output: 'Não foi possível validar a resposta. Tente novamente.', interrupted: 'A resposta foi interrompida. Tente novamente.' };
export function Consultation({ conversationId, messages, setMessages, onBusy, onUnauthorized, onStartNew }: { conversationId: string; messages: MessageView[]; setMessages: React.Dispatch<React.SetStateAction<MessageView[]>>; onBusy: (busy: boolean) => void; onUnauthorized: () => void; onStartNew: () => void }): React.JSX.Element {
  const [content, setContent] = useState(''); const [active, setActive] = useState(false); const [partial, setPartial] = useState(''); const [actions, setActions] = useState<ConsultationAction[]>([]); const [error, setError] = useState(''); const activeRef = useRef(false);
  const [serverUsed, setServerUsed] = useState(0);
  const used = Math.max(serverUsed, messages.filter((message) => message.role === 'employee').length);
  const capped = used >= CONVERSATION_MESSAGE_LIMIT;
  async function send(value: string): Promise<void> {
    const text = value.trim(); if (!text || activeRef.current || capped) return;
    activeRef.current = true; setActive(true); onBusy(true); setError(''); setPartial(''); setActions([]); setContent(''); let done = false;
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages/stream`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: text }) });
      if (response.status === 401) { onUnauthorized(); throw new Error(); }
      if (response.status === 409) {
        const limit = SessionLimitResponseSchema.safeParse(await response.json().catch(() => null));
        if (limit.success) { setServerUsed(limit.data.used); return; }
      }
      if (!response.ok || !response.body) throw new Error();
      await readConsultationStream(response.body, (event) => {
        if (event.type === 'user-message') setMessages((current) => [...current, event.message]);
        else if (event.type === 'text-delta') setPartial((current) => current + event.text);
        else if (event.type === 'action') setActions((current) => [...current, event.action]);
        else if (event.type === 'error') { setActions([]); setError(errors[event.code] ?? 'Não foi possível concluir a resposta.'); }
        else if (event.type === 'done') { done = true; setMessages((current) => [...current, event.message]); setPartial(''); setActions([]); }
      });
      if (!done) throw new Error();
    } catch { setError('Não foi possível concluir a resposta. Recarregue a conversa para verificar o histórico.'); }
    finally { activeRef.current = false; setActive(false); onBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>): void { event.preventDefault(); void send(content); }
  function chips(items: ConsultationAction[]) { return <div className="consultation-actions">{items.map((action) => <span className={action.status} key={action.id}>{action.status === 'succeeded' ? '✓' : '×'} {action.label}</span>)}</div>; }
  return <section className="consultation" aria-label="Conversa"><h2>Mensagens</h2>
    {messages.length === 0 && !active && <p>Descreva sua dúvida de TI para começar.</p>}
    <div className="consultation-messages">{messages.map((message) => <article key={message.id} className={`chat-message ${message.role}`}>
      {message.role === 'agent' && <><strong>Nexo Assist</strong>{message.status === 'completed' && message.decision && chips(message.decision.actions)}</>}
      <p>{message.content}</p>
      {message.status === 'failed' && <p role="alert">{errors[message.decision?.errorCode ?? ''] ?? 'Não foi possível concluir a resposta.'}</p>}
      {message.decision && <><Decision decision={message.decision} />{message.status === 'completed' && <><div className="quick-replies">{message.decision.quickReplies.map((reply) => <button type="button" disabled={active || capped} key={reply} onClick={() => void send(reply)}>{reply}</button>)}</div><div className="ticket-options">{message.decision.tickets.map((ticket) => <button type="button" disabled={active || capped} key={ticket.id} onClick={() => void send(ticket.title)}>{ticket.title} · {ticket.status === 'open' ? 'Aberto' : 'Resolvido'}{ticket.overdue ? ' · prazo vencido' : ''}</button>)}</div></>}</>}
    </article>)}{active && <article className="chat-message agent" aria-live="polite"><strong>Nexo Assist</strong>{chips(actions)}<p>{partial || 'Preparando resposta...'}</p></article>}</div>
    {error && <p role="alert">{error}</p>}
    <p>Mensagens: {used} de {CONVERSATION_MESSAGE_LIMIT}</p>
    <p>Restantes: {Math.max(0, CONVERSATION_MESSAGE_LIMIT - used)}</p>
    {capped && <><p role="status">Você atingiu o limite de 30 mensagens nesta conversa. Inicie uma nova conversa para continuar.</p><button type="button" disabled={active} onClick={onStartNew}>Nova conversa</button></>}
    <form onSubmit={submit}><label htmlFor="message">Mensagem</label><textarea id="message" name="content" value={content} onChange={(event) => setContent(event.target.value)} disabled={active || capped} required maxLength={4000} placeholder="Escreva para o Nexo..." /><button disabled={active || capped} type="submit">Enviar mensagem</button></form>
  </section>;
}
