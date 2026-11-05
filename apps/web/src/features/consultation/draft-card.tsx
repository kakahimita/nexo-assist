'use client';
import {
  DraftInputSchema,
  DraftViewSchema,
  DuplicateConflictSchema,
  TicketViewSchema,
  type DraftView,
  type TicketView,
} from '@nexo/contracts';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

const categories: Record<string, string> = {
  access: 'Acesso',
  network_vpn: 'Rede e VPN',
  hardware: 'Hardware',
  software: 'Software',
  email: 'E-mail',
  other: 'Outros',
};
const priorities: Record<string, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};
const impacts: Record<string, string> = {
  self: 'Somente eu',
  team: 'Minha equipe',
  company: 'Toda a empresa',
};
const states: Record<string, string> = {
  stopped: 'Trabalho parado',
  workaround: 'Trabalho afetado com alternativa',
  request: 'Pedido ou melhoria',
};
const urgencies: Record<string, string> = {
  same_day: 'Compromisso em risco hoje',
  normal: 'Sem compromisso em risco hoje',
};
class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown,
  ) {
    super('Request failed');
  }
}

export function DraftCard({
  draftId,
  onUnauthorized,
  onCommitted,
}: {
  draftId: string;
  onUnauthorized: () => void;
  onCommitted?: () => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const locked = useRef(false);
  const [conflicts, setConflicts] = useState<TicketView[]>([]);
  const [conflictMatches, setConflictMatches] = useState<
    Array<{ id: string; match: 'exact' | 'possible' }>
  >([]);
  const call = useCallback(
    async (path: string, body?: unknown): Promise<unknown> => {
      const response = await fetch(
        path,
        body === undefined
          ? undefined
          : {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
            },
      );
      if (response.status === 401) onUnauthorized();
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new RequestError(response.status, payload);
      return payload;
    },
    [onUnauthorized],
  );
  const load = useCallback(async () => {
    const value = DraftViewSchema.parse(
      await call(`/api/ticket-drafts/${encodeURIComponent(draftId)}`),
    );
    setDraft(value);
    return value;
  }, [call, draftId]);
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch(() => setError('Não foi possível carregar o rascunho.'));
  }, [load]);
  async function perform(action: 'confirm' | 'cancel') {
    if (!draft || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const payload =
        action === 'confirm'
          ? {
              version: draft.version,
              operationId: draft.operationId,
              dismissedCandidateIds: dismissed,
            }
          : { version: draft.version };
      const result = await call(
        `/api/ticket-drafts/${encodeURIComponent(draft.id)}/${action}`,
        payload,
      );
      if (action === 'confirm') {
        TicketViewSchema.parse(result);
        await load();
        onCommitted?.();
      } else setDraft(DraftViewSchema.parse(result));
    } catch (failure) {
      if (failure instanceof RequestError && failure.status === 409) {
        const duplicate = DuplicateConflictSchema.safeParse(failure.payload);
        try {
          await load();
          setDismissed([]);
          setConflicts(
            duplicate.success && draft.input.action !== 'create' ? duplicate.data.candidates : [],
          );
          setConflictMatches(duplicate.success ? (duplicate.data.candidateMatches ?? []) : []);
          setError(
            duplicate.success
              ? 'Há chamados que podem tratar do mesmo problema. Confira os candidatos.'
              : 'O rascunho foi atualizado. Confira os dados antes de confirmar.',
          );
        } catch {
          setError('Não foi possível atualizar o rascunho.');
        }
      } else
        setError('Não foi possível concluir a operação. Tente novamente com o mesmo rascunho.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const current = draft.input;
    const raw =
      current.action === 'create'
        ? {
            action: 'create',
            title: data.get('title'),
            description: data.get('description'),
            type: data.get('type'),
            category: data.get('category'),
            impact: data.get('impact'),
            workState: data.get('workState'),
            urgency: data.get('urgency'),
          }
        : current.action === 'supplement'
          ? { action: 'supplement', ticketId: current.ticketId, content: data.get('content') }
          : current.action === 'reopen'
            ? { action: 'reopen', ticketId: current.ticketId, reason: data.get('reason') }
            : current;
    try {
      const input = DraftInputSchema.parse(raw);
      setDraft(
        DraftViewSchema.parse(
          await call(`/api/ticket-drafts/${encodeURIComponent(draft.id)}/edit`, {
            version: draft.version,
            input,
          }),
        ),
      );
      setDismissed([]);
      setEditing(false);
    } catch (failure) {
      if (failure instanceof RequestError && failure.status === 409) {
        try {
          await load();
          setEditing(false);
          setError('O rascunho foi atualizado. Confira os dados antes de confirmar.');
        } catch {
          setError('Não foi possível atualizar o rascunho.');
        }
      } else setError('Não foi possível salvar. Confira os dados.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const value = draft?.input;
  return (
    <article className="ticket-card draft-card" aria-label="Rascunho do chamado">
      <div className="draft-card-heading">
        <h3>Rascunho do chamado</h3>
        {draft?.status === 'pending' && (
          <span className="draft-pending">Aguardando confirmação</span>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {!draft && !error && <p role="status">Carregando rascunho...</p>}
      {draft?.status === 'committed' && <p>Chamado confirmado.</p>}
      {draft?.status === 'cancelled' && <p>Rascunho cancelado.</p>}
      {draft?.status === 'pending' &&
        value &&
        (editing ? (
          <form onSubmit={(event) => void save(event)}>
            {value.action === 'create' ? (
              <>
                <label>
                  Título
                  <input name="title" required maxLength={200} defaultValue={value.title} />
                </label>
                <label>
                  Descrição
                  <textarea
                    name="description"
                    required
                    maxLength={4000}
                    defaultValue={value.description}
                  />
                </label>
                <label>
                  Tipo
                  <select name="type" defaultValue={value.type}>
                    <option value="INC">Incidente</option>
                    <option value="REQ">Requisição</option>
                  </select>
                </label>
                <label>
                  Categoria
                  <select name="category" defaultValue={value.category}>
                    {Object.entries(categories).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Pessoas afetadas
                  <select name="impact" defaultValue={value.impact}>
                    {Object.entries(impacts).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Situação do trabalho
                  <select name="workState" defaultValue={value.workState}>
                    {Object.entries(states).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Urgência
                  <select name="urgency" defaultValue={value.urgency}>
                    {Object.entries(urgencies).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : value.action === 'supplement' ? (
              <label>
                Informações adicionais
                <textarea name="content" required defaultValue={value.content} />
              </label>
            ) : value.action === 'reopen' ? (
              <label>
                Motivo
                <textarea name="reason" required defaultValue={value.reason} />
              </label>
            ) : null}
            <button disabled={busy} type="submit">
              Salvar alterações
            </button>
            <button type="button" disabled={busy} onClick={() => setEditing(false)}>
              Voltar
            </button>
          </form>
        ) : (
          <>
            {value.action === 'create' ? (
              <>
                <h4 className="draft-title">{value.title}</h4>
                <p className="draft-description">{value.description}</p>
                <div className="draft-details">
                  <p>
                    Tipo: {value.type === 'INC' ? 'Incidente' : 'Requisição'} · Categoria:{' '}
                    {categories[value.category]}
                  </p>
                  <p>Prioridade: {draft.priority && priorities[draft.priority]}</p>
                  <p>Pessoas afetadas: {impacts[value.impact]}</p>
                  <p>
                    {states[value.workState]} · {urgencies[value.urgency]}
                  </p>
                </div>
                {!!draft.candidates?.length && (
                  <div>
                    <p>Confira se algum chamado trata do mesmo problema:</p>
                    {draft.candidates.map((candidate) => (
                      <div key={candidate.id}>
                        <p>{candidate.title}</p>
                        {draft.candidateMatches?.find((match) => match.id === candidate.id)
                          ?.match === 'possible' && (
                          <label>
                            <input
                              type="checkbox"
                              checked={dismissed.includes(candidate.id)}
                              onChange={(event) =>
                                setDismissed((current) =>
                                  event.target.checked
                                    ? [...current, candidate.id]
                                    : current.filter((id) => id !== candidate.id),
                                )
                              }
                            />
                            É outro problema
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p>{value.action === 'supplement' ? value.content : value.reason}</p>
            )}
            {value.action !== 'create' && conflicts.length > 0 && (
              <div>
                <p>Confira se algum chamado trata do mesmo problema:</p>
                {conflicts.map((candidate) => (
                  <div key={candidate.id}>
                    <p>{candidate.title}</p>
                    {conflictMatches.find((match) => match.id === candidate.id)?.match ===
                      'possible' && (
                      <label>
                        <input
                          type="checkbox"
                          checked={dismissed.includes(candidate.id)}
                          onChange={(event) =>
                            setDismissed((current) =>
                              event.target.checked
                                ? [...current, candidate.id]
                                : current.filter((id) => id !== candidate.id),
                            )
                          }
                        />
                        É outro problema
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="draft-actions">
              <button
                type="button"
                disabled={
                  busy ||
                  !!draft.candidates?.some(
                    (candidate) =>
                      draft.candidateMatches?.find((match) => match.id === candidate.id)?.match ===
                        'possible' && !dismissed.includes(candidate.id),
                  ) ||
                  conflicts.some(
                    (candidate) =>
                      conflictMatches.find((match) => match.id === candidate.id)?.match ===
                        'possible' && !dismissed.includes(candidate.id),
                  )
                }
                onClick={() => void perform('confirm')}
              >
                Confirmar rascunho
              </button>
              <button
                type="button"
                disabled={busy || value.action === 'transfer'}
                onClick={() => setEditing(true)}
              >
                Editar rascunho
              </button>
              <button type="button" disabled={busy} onClick={() => void perform('cancel')}>
                Cancelar rascunho
              </button>
            </div>
          </>
        ))}
    </article>
  );
}
