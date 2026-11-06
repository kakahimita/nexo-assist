'use client';
import { ServiceMetricsSchema, type ServiceMetrics } from '@nexo/contracts';
import { useEffect, useState } from 'react';

export function ServiceIndicators(): React.JSX.Element {
  const [metrics, setMetrics] = useState<ServiceMetrics | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    let running = false;
    const controller = new AbortController();
    async function refresh() {
      if (running) return;
      running = true;
      try {
        const response = await fetch('/api/metrics', {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]),
        });
        if (!response.ok) throw new Error();
        const data = ServiceMetricsSchema.parse(await response.json());
        if (current) {
          setMetrics(data);
          setFailed(false);
        }
      } catch {
        if (current) {
          setMetrics(null);
          setFailed(true);
        }
      } finally {
        running = false;
      }
    }
    void refresh();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 15_000);
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      current = false;
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [attempt]);
  const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  return (
    <div className="intro-metrics" aria-label="Indicadores de atendimento">
      {!metrics && (
        <p role="status">
          {failed ? 'Indicadores indisponíveis no momento.' : 'Carregando indicadores...'}
        </p>
      )}
      {failed && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Atualizar indicadores
        </button>
      )}
      <div className="intro-highlights">
        <div>
          <strong>
            {metrics?.firstResponseSeconds != null
              ? `${number.format(metrics.firstResponseSeconds)} s`
              : '—'}
          </strong>
          <span>primeira resposta, em média</span>
        </div>
        <div>
          <strong>
            {metrics?.resolutionPercent != null
              ? `${number.format(metrics.resolutionPercent)}%`
              : '—'}
          </strong>
          <span>resolvidos sem fila</span>
        </div>
        <div>
          <strong>
            {metrics ? metrics.onlineAnalysts : '—'}
            {metrics && metrics.onlineAnalysts > 0 && <i aria-hidden="true" />}
          </strong>
          <span>analistas online agora</span>
        </div>
      </div>
    </div>
  );
}
