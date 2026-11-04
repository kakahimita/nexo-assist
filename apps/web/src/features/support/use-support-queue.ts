'use client';

import {
  SupportConversationSummarySchema,
  type SupportConversationFilter,
  type SupportConversationSummary,
} from '@nexo/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

type QueueStatus = 'loading' | 'ready' | 'error';

export function useSupportQueue(filter: SupportConversationFilter, onLogout: () => void) {
  const [items, setItems] = useState<SupportConversationSummary[]>([]);
  const [status, setStatus] = useState<QueueStatus>('loading');
  const [error, setError] = useState('');
  const request = useRef(0);
  const activeController = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    const id = ++request.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    setItems([]);
    setStatus('loading');
    setError('');
    try {
      const response = await fetch(`/api/support/conversations?filter=${filter}`, {
        signal: controller.signal,
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) throw new Error('queue_failed');
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('queue_failed');
      if (id !== request.current) return;
      setItems(data.map((item) => SupportConversationSummarySchema.parse(item)));
      setStatus('ready');
    } catch (cause) {
      if (id !== request.current || (cause instanceof DOMException && cause.name === 'AbortError'))
        return;
      setItems([]);
      setStatus('error');
      setError('Não foi possível carregar as conversas.');
    }
  }, [filter, onLogout]);

  useEffect(() => {
    void Promise.resolve().then(reload);
    return () => {
      activeController.current?.abort();
      request.current += 1;
    };
  }, [reload]);

  return { items, status, error, reload };
}
