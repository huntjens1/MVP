export function makeEventStream(url: string, onEvent: (type: string, data: any)=>void) {
  let es: EventSource | null = null;
  let retry = 1000;
  const connect = () => {
    es = new EventSource(url, { withCredentials: true });
    es.onmessage = (ev) => onEvent('message', safe(ev.data));
    es.addEventListener('suggestions', (ev: MessageEvent) => onEvent('suggestions', safe((ev as any).data)));
    es.onerror = () => {
      es?.close();
      setTimeout(connect, Math.min(retry, 15000));
      retry *= 2;
    };
  };
  function safe(s: string) { try { return JSON.parse(s); } catch { return s; } }
  connect();
  return () => es?.close();
}
