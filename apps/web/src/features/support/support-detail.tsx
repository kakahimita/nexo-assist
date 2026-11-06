'use client';

import type { MessageView, SupportConversationView, UserView } from '@nexo/contracts';
import { Fragment } from 'react';

import { getEmployeeInitials } from '../history/employee-initials';
import { reasonLabels } from './support-queue';
import { SupportTicketContext } from './support-ticket-context';
import {
  formatDayKey,
  formatDayLabel,
  formatFullDateTime,
  formatMessageTime,
  supportAvatarTone,
} from './support-visuals';

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

function senderName(message: MessageView, detail: SupportConversationView): string {
  if (message.role === 'employee') return detail.conversation.employee.name;
  if (message.role === 'agent') return 'Nexo Assist';
  return message.authorName ?? 'Suporte';
}

function senderBadge(message: MessageView): string | null {
  if (message.role === 'agent') return 'IA';
  if (message.role === 'analyst') return 'Suporte N2';
  return null;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
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
  onClose: (outcome?: 'approved' | 'resolved') => void;
}): React.JSX.Element {
  const owned =
    detail.conversation.state === 'with_analyst' &&
    detail.conversation.assignedAnalystId === user.id;
  const linkedTicket =
    detail.tickets.find((ticket) => ticket.id === detail.conversation.contextTicketId) ?? null;
  const closingRequest = linkedTicket?.type === 'REQ';
  const waiting = detail.conversation.state === 'waiting_for_analyst';
  const employeeName = detail.conversation.employee.name;

  return (
    <section aria-label="Atendimento" className="support-detail">
      <header className="support-detail-header" data-state={detail.conversation.state}>
        <span
          className={`support-detail-avatar support-tone-${supportAvatarTone(employeeName)}`}
          aria-hidden="true"
        >
          {getEmployeeInitials(employeeName)}
        </span>
        <div className="support-detail-title">
          <strong>{employeeName}</strong>
          <span className="support-detail-meta">
            {linkedTicket?.number ?? 'Atendimento humano'}
          </span>
        </div>
        <span className="support-mode" data-state={detail.conversation.state} role="status">
          {stateLabel(detail, owned)}
        </span>
        {owned && (
          <div className="support-detail-actions">
            <button
              type="button"
              className="support-action support-action-secondary"
              disabled={busy}
              onClick={onReturn}
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
                <rect x="4" y="7" width="16" height="12" rx="3" />
                <path d="M12 3v4M9 12h.01M15 12h.01M9.5 16h5" />
              </svg>
              Devolver ao agente
            </button>
            {closingRequest ? (
              <>
                <button
                  type="button"
                  className="support-action support-action-danger"
                  disabled={busy}
                  onClick={() => onClose('approved')}
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
                    <circle cx="12" cy="12" r="9" />
                    <path d="m8.5 12 2.5 2.5 4.5-5" />
                  </svg>
                  Aprovar solicitação
                </button>
                <button
                  type="button"
                  className="support-action support-action-danger"
                  disabled={busy}
                  onClick={() => onClose('resolved')}
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
                    <circle cx="12" cy="12" r="9" />
                    <path d="m8.5 12 2.5 2.5 4.5-5" />
                  </svg>
                  Concluir atendimento
                </button>
              </>
            ) : (
              <button
                type="button"
                className="support-action support-action-danger"
                disabled={busy}
                onClick={() => onClose()}
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
                  <circle cx="12" cy="12" r="9" />
                  <path d="m8.5 12 2.5 2.5 4.5-5" />
                </svg>
                Encerrar atendimento
              </button>
            )}
          </div>
        )}
      </header>
      {detail.conversation.handoff && (
        <section className="support-handoff" aria-label="Resumo da transferência">
          <h2>Resumo da transferência</h2>
          <p>Motivo: {reasonLabels[detail.conversation.handoff.reason]}</p>
          <p>{detail.conversation.handoff.summary}</p>
          <time dateTime={detail.conversation.handoff.requestedAt}>
            Solicitada em {formatFullDateTime(detail.conversation.handoff.requestedAt)}
          </time>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="support-messages">
        {detail.messages.length === 0 && <p>Nenhuma mensagem.</p>}
        {detail.messages.map((message, index) => {
          const previous = detail.messages[index - 1];
          const showDay =
            previous === undefined ||
            formatDayKey(previous.createdAt) !== formatDayKey(message.createdAt);
          const badge = senderBadge(message);

          return (
            <Fragment key={message.id}>
              {showDay && (
                <div className="support-day" role="separator">
                  <span>{formatDayLabel(message.createdAt)}</span>
                </div>
              )}
              <article className={`support-message support-message-${message.role}`}>
                {message.role === 'employee' ? (
                  <span className="visually-hidden">{senderName(message, detail)}</span>
                ) : (
                  <div className="support-message-sender">
                    <strong>{senderName(message, detail)}</strong>
                    {badge && <span className="support-sender-badge">{badge}</span>}
                  </div>
                )}
                <div className="support-message-bubble">
                  <p>{message.content}</p>
                  <span className="support-message-meta">
                    <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                    {message.role !== 'employee' && (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m2 12 5 5L17 7" />
                        <path d="m9 12 5 5L21 7" />
                      </svg>
                    )}
                  </span>
                </div>
              </article>
            </Fragment>
          );
        })}
      </div>
      <SupportTicketContext
        tickets={detail.tickets}
        employeeName={employeeName}
        contextTicketId={detail.conversation.contextTicketId}
        handoff={detail.conversation.handoff}
      />
      <footer className="support-detail-footer">
        {waiting && (
          <div className="support-takeover">
            <span className="support-takeover-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 14V6a1.5 1.5 0 0 1 3 0v5" />
                <path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11" />
                <path d="M14 11V6a1.5 1.5 0 0 1 3 0v7a5 5 0 0 1-5 5h-1a5 5 0 0 1-4-2l-3-4a1.5 1.5 0 0 1 2.4-1.8L8 14" />
              </svg>
            </span>
            <div className="support-takeover-copy">
              <strong>{firstName(employeeName)} espera um atendente</strong>
              <span>Agent pausado</span>
            </div>
            <button
              type="button"
              className="support-action support-action-primary"
              disabled={busy}
              onClick={onClaim}
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
                <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
                <path d="M4 14h2v5H5a1 1 0 0 1-1-1z" />
                <path d="M20 14h-2v5h1a1 1 0 0 0 1-1z" />
              </svg>
              Assumir atendimento
            </button>
          </div>
        )}
        {waiting ? (
          <p className="support-composer-locked">Assuma o atendimento para responder.</p>
        ) : owned ? (
          <form
            className="support-composer"
            onSubmit={(event) => {
              event.preventDefault();
              onReply();
            }}
          >
            <label htmlFor="reply" className="visually-hidden">
              Resposta
            </label>
            <textarea
              id="reply"
              rows={1}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              disabled={busy}
              placeholder={`Escreva para ${firstName(employeeName)}...`}
              required
            />
            <button type="submit" disabled={busy}>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 3 3 9-3 9 18-9z" />
                <path d="M6 12h15" />
              </svg>
              <span className="visually-hidden">Enviar resposta</span>
            </button>
          </form>
        ) : (
          <p className="support-detail-readonly">{readOnlyMessage(detail)}</p>
        )}
      </footer>
    </section>
  );
}
