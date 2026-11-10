'use client';
import { useEffect, useRef, useState, type FocusEvent } from 'react';
import type { ChatErrorCopy } from './errors';
function ErrorIcon({ className }: { className: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  );
}
export function ChatErrorInline({ title, body }: ChatErrorCopy): React.JSX.Element {
  return (
    <div className="chat-error-inline">
      <ErrorIcon className="chat-error-inline-icon" />
      <div className="chat-error-inline-copy">
        <p className="chat-error-inline-title">{title}</p>
        <p className="chat-error-inline-body">{body}</p>
      </div>
    </div>
  );
}
export function ErrorToast({
  title,
  body,
  onDismiss,
}: ChatErrorCopy & {
  onDismiss: () => void;
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const [run, setRun] = useState(0);
  const wasPaused = useRef(false);
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => dismiss.current(), 5_000);
    return () => window.clearTimeout(timer);
  }, [paused]);
  useEffect(() => {
    if (wasPaused.current && !paused) setRun((value) => value + 1);
    wasPaused.current = paused;
  }, [paused]);
  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  }
  return (
    <div
      className="chat-error-toast"
      role="alert"
      aria-atomic="true"
      data-paused={paused}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
    >
      <ErrorIcon className="chat-error-toast-icon" />
      <div className="chat-error-toast-copy">
        <p className="chat-error-toast-title">{title}</p>
        <p className="chat-error-toast-body">{body}</p>
      </div>
      <button
        className="chat-error-toast-close"
        type="button"
        aria-label="Fechar notificação"
        onClick={onDismiss}
      >
        ×
      </button>
      <span key={run} className="chat-error-toast-progress" aria-hidden="true" />
    </div>
  );
}
