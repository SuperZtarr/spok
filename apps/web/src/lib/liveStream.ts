/*
 * Client SSE des séances live, basé sur fetch (EventSource ne permet pas d'envoyer le header
 * Authorization ni de rafraîchir le token). Reconnexion automatique avec backoff (1 s → 15 s max) ;
 * onOpen est appelé à chaque (re)connexion : l'appelant doit alors refetch l'état complet, le flux
 * ne rejouant pas les événements manqués. Retourne une fonction d'arrêt.
 */
import type { LiveEvent } from '@spok/shared';
import { getValidAccessToken, LIVE_API_URL } from './api';

export function parseSseChunk(buffer: string): { events: LiveEvent[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: LiveEvent[] = [];
  for (const part of parts) {
    const data = part.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n');
    if (!data) continue;
    try { events.push(JSON.parse(data)); } catch { /* message corrompu : ignoré */ }
  }
  return { events, rest };
}

export function openLiveStream(
  sessionId: string,
  handlers: { onEvent: (e: LiveEvent) => void; onOpen: () => void },
): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let delay = 1000;

  const run = async () => {
    while (!stopped) {
      controller = new AbortController();
      try {
        const token = await getValidAccessToken();
        const res = await fetch(`${LIVE_API_URL}/live-sessions/${sessionId}/stream`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (res.ok && res.body) {
          delay = 1000;
          handlers.onOpen();
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            const parsed = parseSseChunk(buffer + decoder.decode(value, { stream: true }));
            buffer = parsed.rest;
            parsed.events.forEach(handlers.onEvent);
          }
        }
      } catch { /* coupure réseau ou abort */ }
      if (stopped) return;
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 15000);
    }
  };
  run();
  return () => { stopped = true; controller?.abort(); };
}
