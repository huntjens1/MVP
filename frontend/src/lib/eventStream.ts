// frontend/src/lib/eventStream.ts
// Generieke SSE helper met backoff en named+default events.

export type EventHandler = (type: string, data: any) => void;

export function makeEventStream(
  url: string,
  onEvent: EventHandler,
  names: string[] = ["message", "assist", "suggestions"]
) {
  let es: EventSource | null = null;
  let retry = 1000;

  const safe = (s: any) => {
    try {
      return typeof s === "string" ? JSON.parse(s) : s;
    } catch {
      return s;
    }
  };

  const connect = () => {
    es = new EventSource(url, { withCredentials: true });

    // default message event
    es.onmessage = (ev) => onEvent("message", safe((ev as MessageEvent).data));

    // named events
    for (const n of names.filter((n) => n !== "message")) {
      es.addEventListener(n, (ev: MessageEvent) => onEvent(n, safe(ev.data)));
    }

    es.onerror = () => {
      try {
        es?.close();
      } catch {}
      setTimeout(connect, Math.min(retry, 15000));
      retry *= 2; // exponential backoff
    };
  };

  connect();
  return () => es?.close();
}
