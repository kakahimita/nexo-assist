'use client';

import { DraftInputSchema, DraftViewSchema, DuplicateConflictSchema, TicketEventViewSchema, TicketViewSchema, type DraftView, type TicketEventView, type TicketView } from '@nexo/contracts';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

const draftKey = 'nexo_ticket_draft';
const categories: Record<string, string> = { access: 'Acesso', network_vpn: 'Rede e VPN', hardware: 'Hardware', software: 'Software', email: 'E-mail', other: 'Outros' };
const priorities: Record<string, string> = { critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa' };
const impacts: Record<string, string> = { self: 'Somente eu', team: 'Minha equipe', company: 'Toda a empresa' };
const workStates: Record<string, string> = { stopped: 'Trabalho parado', workaround: 'Trabalho afetado com alternativa', request: 'Pedido ou melhoria' };
const urgencies: Record<string, string> = { same_day: 'Compromisso em risco hoje', normal: 'Sem compromisso em risco hoje' };

class RequestError extends Error {
  constructor(readonly status: number, readonly payload: unknown) { super('Request failed'); }
}

export function Tickets({ onUnauthorized }: { onUnauthorized: () => void }): React.JSX.Element {
  const [tickets, setTickets] = useState<TicketView[]>([]);
  const [selected, setSelected] = useState<TicketView | null>(null);
  const [events, setEvents] = useState<TicketEventView[]>([]);
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [conflicts, setConflicts] = useState<TicketView[]>([]);
  const [editor, setEditor] = useState<'create' | 'supplement' | 'reopen' | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busyRef = useRef(false);
  const selectionVersion = useRef(0);

  const call = useCallback(async (url: string, body?: unknown): Promise<unknown> => {
    const response = await fetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (response.status === 401) onUnauthorized();
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new RequestError(response.status, payload);
    return payload;
  }, [onUnauthorized]);

  const load = useCallback(async () => {
    const data = await call('/api/tickets');
    if (!Array.isArray(data)) throw new Error('Invalid tickets');
    setTickets(data.map((item: unknown) => TicketViewSchema.parse(item)));
  }, [call]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        await load();
        const id = sessionStorage.getItem(draftKey);
        if (id) {
          try {
            const saved = DraftViewSchema.parse(await call(`/api/ticket-drafts/${encodeURIComponent(id)}`));
            if (active && saved.status === 'pending') setDraft(saved);
            else sessionStorage.removeItem(draftKey);
          } catch (failure) {
            if (failure instanceof RequestError && failure.status === 404) sessionStorage.removeItem(draftKey);
            else throw failure;
          }
        }
      } catch { if (active) setError('Não foi possível carregar os chamados. Tente novamente.'); }
      finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [call, load]);

  async function choose(ticket: TicketView) {
    const version = ++selectionVersion.current;
    try {
      const data = await call(`/api/tickets/${encodeURIComponent(ticket.id)}/history`);
      if (!Array.isArray(data)) throw new Error('Invalid history');
      if (version !== selectionVersion.current) return;
      setSelected(ticket); setEvents(data.map((item: unknown) => TicketEventViewSchema.parse(item))); setError('');
    } catch { if (version === selectionVersion.current) setError('Não foi possível carregar o histórico do chamado.'); }
  }

  async function refreshDraftAfterConflict(previous: DraftView) {
    try {
      const latest = DraftViewSchema.parse(await call(`/api/ticket-drafts/${previous.id}`));
      setEditor(null); setEditing(false); setConflicts([]);
      if (latest.status !== 'pending') {
        sessionStorage.removeItem(draftKey); setDraft(null);
        setError(latest.status === 'committed' ? 'Este rascunho já foi confirmado. Atualize a lista de chamados.' : 'Este rascunho foi cancelado.');
      } else {
        setDraft(latest);
        setError(latest.version !== previous.version || latest.operationId !== previous.operationId
          ? 'O rascunho foi atualizado. Confira os dados antes de confirmar.'
          : 'Não foi possível confirmar. Confira a situação do chamado e revise o rascunho.');
      }
    } catch { setError('Não foi possível atualizar o rascunho. Tente novamente.'); }
  }

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || !editor) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    const data = new FormData(event.currentTarget);
    const ticketId = editing && draft && draft.input.action !== 'create' ? draft.input.ticketId : selected?.id;
    const raw = editor === 'create'
      ? { action: editor, title: data.get('title'), description: data.get('description'), type: data.get('type'), category: data.get('category'), impact: data.get('impact'), workState: data.get('workState'), urgency: data.get('urgency') }
      : editor === 'supplement' ? { action: editor, ticketId, content: data.get('content') } : { action: editor, ticketId, reason: data.get('reason') };
    try {
      const input = DraftInputSchema.parse(raw);
      const saved = DraftViewSchema.parse(await call(editing && draft ? `/api/ticket-drafts/${draft.id}/edit` : '/api/ticket-drafts', editing && draft ? { version: draft.version, input } : input));
      sessionStorage.setItem(draftKey, saved.id); setDraft(saved); setConflicts([]); setEditor(null); setEditing(false);
    } catch (failure) {
      if (editing && draft && failure instanceof RequestError && failure.status === 409) await refreshDraftAfterConflict(draft);
      else setError('Não foi possível preparar o rascunho. Confira os dados e tente novamente.');
    }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function cancelDraft() {
    if (!draft || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await call(`/api/ticket-drafts/${draft.id}/cancel`, { version: draft.version }); sessionStorage.removeItem(draftKey); setDraft(null); setConflicts([]); setEditor(null); setEditing(false); setNotice('Rascunho cancelado.'); }
    catch (failure) {
      if (failure instanceof RequestError && failure.status === 409) await refreshDraftAfterConflict(draft);
      else setError('Não foi possível cancelar o rascunho. Tente novamente.');
    }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function confirmDraft() {
    if (!draft || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const ticket = TicketViewSchema.parse(await call(`/api/ticket-drafts/${draft.id}/confirm`, { version: draft.version, operationId: draft.operationId }));
      sessionStorage.removeItem(draftKey); setDraft(null); setConflicts([]); setNotice('Alteração confirmada.');
      try { await load(); await choose(ticket); }
      catch { setError('Alteração confirmada, mas não foi possível atualizar a lista de chamados.'); }
    } catch (failure) {
      const duplicate = failure instanceof RequestError ? DuplicateConflictSchema.safeParse(failure.payload) : null;
      if (duplicate?.success) {
        setConflicts(duplicate.data.candidates);
        if (draft.input.action === 'create') setDraft({ ...draft, candidates: duplicate.data.candidates });
        setError('Já existe um chamado com esse título. Revise os candidatos.');
      } else if (failure instanceof RequestError && failure.status === 409) await refreshDraftAfterConflict(draft);
      else setError('Não foi possível confirmar. Tente novamente com o mesmo rascunho.');
    } finally { busyRef.current = false; setBusy(false); }
  }

  const current = editing ? draft?.input : undefined;
  const createValues = current?.action === 'create' ? current : undefined;
  const detail = current?.action === 'supplement' ? current.content : current?.action === 'reopen' ? current.reason : '';
  const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

  return <section className="tickets" aria-label="Chamados">
    <h2>Chamados</h2>
    <p>Consulte seus chamados ou confira um rascunho antes de confirmar uma alteração.</p>
    {loading && <p role="status">Carregando chamados...</p>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <button disabled={busy || !!draft} onClick={() => { setEditor('create'); setEditing(false); setNotice(''); }}>Novo chamado</button>
    {!loading && tickets.length === 0 && <p>Nenhum chamado encontrado.</p>}
    <nav aria-label="Seus chamados">{tickets.map((ticket) => <button key={ticket.id} disabled={busy} onClick={() => void choose(ticket)}>{ticket.title}</button>)}</nav>
    {selected && <article className="ticket-card"><h3>{selected.title}</h3><p>{selected.description}</p><p>Situação: {selected.status === 'open' ? 'Aberto' : 'Resolvido'} · Prioridade: {priorities[selected.priority]}</p><p>Prazo: {formatDate(selected.deadline)} {selected.overdue && '· vencido'}</p>
      <h4>Histórico</h4><ul>{events.map((item) => <li key={item.id}>{item.content}</li>)}</ul>
      {selected.status === 'open' ? <button disabled={busy || !!draft} onClick={() => { setEditor('supplement'); setEditing(false); }}>Adicionar informação</button> : <button disabled={busy || !!draft} onClick={() => { setEditor('reopen'); setEditing(false); }}>Reabrir chamado</button>}
    </article>}
    {editor && <form key={`${editor}-${editing ? draft?.version : 'new'}`} className="ticket-form" onSubmit={(event) => void review(event)}>
      <h3>{editor === 'create' ? 'Novo chamado' : editor === 'supplement' ? 'Adicionar informação' : 'Reabrir chamado'}</h3>
      {editor === 'create' ? <>
        <label>Título<input name="title" required maxLength={200} defaultValue={createValues?.title} /></label>
        <label>Descrição<textarea name="description" required maxLength={4000} defaultValue={createValues?.description} /></label>
        <label>Tipo<select name="type" required defaultValue={createValues?.type ?? ''}><option value="">Selecione</option><option value="INC">Incidente</option><option value="REQ">Requisição</option></select></label>
        <label>Categoria<select name="category" required defaultValue={createValues?.category ?? ''}><option value="">Selecione</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Pessoas afetadas<select name="impact" required defaultValue={createValues?.impact ?? ''}><option value="">Selecione</option>{Object.entries(impacts).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Situação do trabalho<select name="workState" required defaultValue={createValues?.workState ?? ''}><option value="">Selecione</option>{Object.entries(workStates).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Urgência<select name="urgency" required defaultValue={createValues?.urgency ?? ''}><option value="">Selecione</option>{Object.entries(urgencies).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </> : <label>{editor === 'supplement' ? 'Informações adicionais' : 'Motivo'}<textarea name={editor === 'supplement' ? 'content' : 'reason'} required maxLength={4000} defaultValue={detail} /></label>}
      <button disabled={busy}>Revisar chamado</button><button type="button" disabled={busy} onClick={() => { setEditor(null); setEditing(false); }}>Voltar</button>
    </form>}
    {draft && !editor && <article className="ticket-card" aria-label="Rascunho para confirmação"><h3>Confira o rascunho</h3>
      {draft.input.action === 'create' ? <><p>{draft.input.title}</p><p>{draft.input.description}</p><p>Tipo: {draft.input.type === 'INC' ? 'Incidente' : 'Requisição'} · Categoria: {categories[draft.input.category]}</p><p>Prioridade: {draft.priority && priorities[draft.priority]}</p><p>Pessoas afetadas: {impacts[draft.input.impact]}</p><p>{workStates[draft.input.workState]} · {urgencies[draft.input.urgency]}</p>
        {!!draft.candidates?.length && <div><p>Já existe um chamado com esse título. Edite o título ou cancele e adicione informações ao chamado existente:</p>{draft.candidates.map((candidate) => <button key={candidate.id} disabled={busy} onClick={() => void choose(candidate)}>{candidate.title}</button>)}</div>}
      </> : <p>{draft.input.action === 'supplement' ? draft.input.content : draft.input.reason}</p>}
      {draft.input.action !== 'create' && conflicts.length > 0 && <div><p>Chamados com o mesmo título:</p>{conflicts.map((candidate) => <button key={candidate.id} disabled={busy} onClick={() => void choose(candidate)}>{candidate.title}</button>)}</div>}
      <button disabled={busy || !!draft.candidates?.length || conflicts.length > 0} onClick={() => void confirmDraft()}>Confirmar alteração</button>
      <button disabled={busy || draft.input.action === 'transfer'} onClick={() => { setEditor(draft.input.action === 'transfer' ? null : draft.input.action); setEditing(true); }}>Editar rascunho</button>
      <button disabled={busy} onClick={() => void cancelDraft()}>Cancelar rascunho</button>
    </article>}
  </section>;
}
