import { useEffect, useRef, useState } from 'react';

export interface SSEEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

export function useSSE(url: string, enabled = true) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem('token');
    const fullUrl = token ? `${url}?token=${token}` : url;
    const es = new EventSource(fullUrl);
    esRef.current = es;

    es.onopen = () => setIsConnected(true);

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as SSEEvent;
        setEvents((prev) => [parsed, ...prev].slice(0, 100));
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [url, enabled]);

  const clearEvents = () => setEvents([]);

  return { events, isConnected, clearEvents };
}
