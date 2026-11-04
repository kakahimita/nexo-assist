'use client';

import type { SupportConversationView, UserView } from '@nexo/contracts';
import { reasonLabels } from './support-queue';
import { SupportTicketContext } from './support-ticket-context';

function stateLabel(detail: SupportConversationView, owned: boolean): string {
  if (detail.conversation.state === 'waiting_for_analyst') return 'Aguardando atendente';
  if (owned) return 'Você está atendendo';
  if (detail.conversation.state === 'with_analyst') return 'Em atendimento por outro analista';
  if (detail.conversation.state === 'agent') return 'Com o agente';
  return 'Atendimento encerrado';
}

function readOnlyMessage(detail: SupportConversationView): string {
  if (detail.conversation.state === 'waiting_for_analyst')
    return 'Assuma o atendimento para responder.';
  if (detail.conversation.state === 'with_analyst')
    return 'Somente o analista responsável pode responder.';
  if (detail.conversation.state === 'agent') return 'O atendimento está com o agente.';
  return 'Atendimento encerrado.';
}

export function SupportDetail({
  detail,
  user,
  busy,
  draft,
  error,
  onDraftChange,
  onClaim,
  onReply,
  onReturn,
  onClose,
}: {
  detail: SupportConversationView;
  user: UserView;
  busy: boolean;
  draft: string;
  error: string;
  onDraftChange: (value: string) => void;
  onClaim: () => void;
  onReply: () => void;
  onReturn: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const owned =
    detail.conversation.state === 'with_analyst' &&
    detail.conversation.assignedAnalystId === user.id;

  return (
    <section aria-label="Atendimento" className="support-detail">
      <header className="support-detail-header">
        <div className="support-detail-title">
          <strong>{detail.conversation.employee.name}</strong>
          <span role="status">{stateLabel(detail, owned)}</span>
        </div>
        {detail.conversation.state === 'waiting_for_analyst' ? (
          <button type="button" disabled={busy} onClick={onClaim}>
            Assumir atendimento
          </button>
        ) : owned ? (
          <div className="support-detail-actions">
            <button type="button" disabled={busy} onClick={onReturn}>
              Devolver ao agente
            </button>
            <button type="button" disabled={busy} onClick={onClose}>
              Encerrar atendimento
            </button>
          </div>
        ) : null}
      </header>
      {detail.conversation.handoff && (
        <section className="support-handoff" aria-label="Resumo da transferência">
          <h2>Resumo da transferência</h2>
          <p>Motivo: {reasonLabels[detail.conversation.handoff.reason]}</p>
          <p>{detail.conversation.handoff.summary}</p>
          <time dateTime={detail.conversation.handoff.requestedAt}>
            Solicitada em{' '}
            {new Intl.DateTimeFormat('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
              timeZone: 'America/Sao_Paulo',
            }).format(new Date(detail.conversation.handoff.requestedAt))}
          </time>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="support-messages">
        {detail.messages.length === 0 && <p>Nenhuma mensagem.</p>}
        {detail.messages.map((message) => (
          <article className={`support-message support-message-${message.role}`} key={message.id}>
            <strong>
              {message.role === 'employee'
                ? detail.conversation.employee.name
                : message.role === 'agent'
                  ? 'Nexo Assist'
                  : (message.authorName ?? 'Suporte')}
            </strong>
            <p>{message.content}</p>
            <time dateTime={message.createdAt}>
              {new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
                timeZone: 'America/Sao_Paulo',
              }).format(new Date(message.createdAt))}
            </time>
          </article>
        ))}
      </div>
      <SupportTicketContext
        tickets={detail.tickets}
        employeeName={detail.conversation.employee.name}
      />
      {!owned ? (
        <p className="support-detail-readonly">{readOnlyMessage(detail)}</p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onReply();
          }}
        >
          <label htmlFor="reply">Resposta</label>
          <textarea
            id="reply"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            disabled={busy}
            required
          />
          <button type="submit" disabled={busy}>
            Enviar resposta
          </button>
        </form>
      )}
    </section>
  );
}
