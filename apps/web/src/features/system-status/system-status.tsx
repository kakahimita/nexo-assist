'use client';

import type { HealthResponse } from '@nexo/contracts';
import { useCallback, useEffect, useState } from 'react';

import { fetchApiHealth, getApiBaseUrl } from './api';

const REQUEST_TIMEOUT_MS = 5_000;

type StatusState =
  | { kind: 'loading' }
  | { kind: 'success'; health: HealthResponse }
  | { kind: 'error' };

export function SystemStatus(): React.JSX.Element {
  const [state, setState] = useState<StatusState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    fetchApiHealth(getApiBaseUrl(), controller.signal)
      .then((health) => {
        if (active) {
          setState({ kind: 'success', health });
        }
      })
      .catch(() => {
        if (active) {
          setState({ kind: 'error' });
        }
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  if (state.kind === 'success') {
    return (
      <section className="status-panel" aria-labelledby="status-title">
        <h2 id="status-title">Estado do sistema</h2>
        <p role="status">API conectada</p>
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="status-panel" aria-labelledby="status-title">
        <h2 id="status-title">Estado do sistema</h2>
        <div role="alert">
          <p>Não foi possível conectar à API.</p>
          <button type="button" onClick={retry}>
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="status-panel" aria-labelledby="status-title">
      <h2 id="status-title">Estado do sistema</h2>
      <p role="status">Verificando conexão...</p>
    </section>
  );
}
