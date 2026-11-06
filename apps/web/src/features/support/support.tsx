'use client';
import {
  SupportConversationViewSchema,
  SupportReplyInputSchema,
  type SupportConversationFilter,
  type SupportConversationView,
  type UserView,
} from '@nexo/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SupportDetail } from './support-detail';
import { SupportQueue } from './support-queue';
import { useSupportQueue } from './use-support-queue';

function withoutDraft(drafts: Record<string, string>, id: string): Record<string, string> {
  const next = { ...drafts };
  delete next[id];
  return next;
}

export function Support({
  user,
  onLogout,
  onQueueCountChange,
}: {
  user: UserView;
  onLogout: () => void;
  onQueueCountChange?: (count: number) => void;
}): React.JSX.Element {
  const [filter, setFilter] = useState<SupportConversationFilter>('waiting');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<SupportConversationView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [detailError, setDetailError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const selectionVersion = useRef(0);
  const selectionController = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const {
    items: queue,
    status: queueStatus,
    error: queueError,
    reload: loadQueue,
  } = useSupportQueue(filter, onLogout);

  useEffect(() => {
    if (queueStatus === 'ready') onQueueCountChange?.(queue.length);
  }, [onQueueCountChange, queue.length, queueStatus]);

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

  useEffect(
    () => () => {
      selectionController.current?.abort();
    },
    [],
  );

  async function select(id: string): Promise<boolean> {
    const version = ++selectionVersion.current;
    selectionController.current?.abort();
    const controller = new AbortController();
    selectionController.current = controller;
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setDetailError('');
    setActionError('');
    setNotice('');
    try {
      const data: unknown = await (
        await call(`/api/support/conversations/${id}`, { signal: controller.signal })
      ).json();
      if (version !== selectionVersion.current) return true;
      setDetail(SupportConversationViewSchema.parse(data));
      return true;
    } catch (cause) {
      if (version !== selectionVersion.current) return false;
      if (cause instanceof DOMException && cause.name === 'AbortError') return false;
      setDetailError('Não foi possível carregar a conversa.');
      return false;
    } finally {
      if (version === selectionVersion.current) setDetailLoading(false);
    }
  }

  async function act(path: string, body: string): Promise<boolean> {
    if (busyRef.current) return false;
    const targetId = selectedId;
    busyRef.current = true;
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await call(`/api/support/conversations/${targetId}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      return true;
    } catch {
      setActionError('Não foi possível concluir a ação.');
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function claim() {
    const targetId = selectedId;
    if (!(await act('claim', '{}'))) return;
    await select(targetId);
    await loadQueue();
  }

  async function reply() {
    const targetId = selectedId;
    const parsed = SupportReplyInputSchema.safeParse({
      content: (drafts[targetId] ?? '').trim(),
    });
    if (!parsed.success) {
      setActionError('Informe uma resposta válida.');
      return;
    }
    if (!(await act('reply', JSON.stringify(parsed.data)))) return;
    setDrafts((current) => withoutDraft(current, targetId));
    if (!(await select(targetId)))
      setNotice('Resposta enviada. Não foi possível atualizar a conversa.');
  }

  async function returnToAgent() {
    const targetId = selectedId;
    if (!(await act('return', '{}'))) return;
    setDrafts((current) => withoutDraft(current, targetId));
    setDetail(null);
    setSelectedId('');
    setNotice('Atendimento devolvido ao agente.');
    await loadQueue();
  }

  async function close(outcome?: 'approved' | 'resolved') {
    const targetId = selectedId;
    if (!(await act('close', JSON.stringify(outcome ? { outcome } : {})))) return;
    setDrafts((current) => withoutDraft(current, targetId));
    setDetail(null);
    setSelectedId('');
    setNotice('Atendimento encerrado.');
    await loadQueue();
  }

  return (
    <div className="support">
      <div className="support-queue-column">
        <SupportQueue
          items={queue}
          filter={filter}
          selectedId={selectedId}
          status={queueStatus}
          error={queueError}
          busy={busy}
          onFilterChange={setFilter}
          onSelect={(id) => {
            if (!busyRef.current) void select(id);
          }}
          onRetry={() => void loadQueue()}
        />
      </div>
      <div className="support-detail-column">
        {notice && <p role="status">{notice}</p>}
        {detailError && (
          <div role="alert">
            <p>{detailError}</p>
            {selectedId && (
              <button type="button" onClick={() => void select(selectedId)}>
                Tentar novamente
              </button>
            )}
          </div>
        )}
        {detailLoading && <p role="status">Carregando conversa…</p>}
        {detail && (
          <SupportDetail
            detail={detail}
            user={user}
            busy={busy}
            draft={drafts[selectedId] ?? ''}
            error={actionError}
            onDraftChange={(value) => setDrafts((current) => ({ ...current, [selectedId]: value }))}
            onClaim={() => void claim()}
            onReply={() => void reply()}
            onReturn={() => void returnToAgent()}
            onClose={(outcome) => void close(outcome)}
          />
        )}
      </div>
    </div>
  );
}
