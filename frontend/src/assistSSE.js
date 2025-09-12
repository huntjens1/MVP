// frontend/src/assistSSE.js
export function openAssistStream({ conversationId, onDelta, onDone, onError }) {
  if (!conversationId) throw new Error("conversationId is vereist");
  const url = `/api/assist-stream?conversation_id=${encodeURIComponent(conversationId)}`;
  const es = new EventSource(url, { withCredentials: true });

  const handle = (raw) => {
    try {
      const payload = typeof raw === "string" ? JSON.parse(raw) : raw || {};
      // streaming-delta support
      if (payload?.type === "delta" && typeof payload.text === "string") {
        onDelta && onDelta(payload.text);
        return;
      }
      // final payload (normalize)
      const actions =
        payload.actions ??
        payload.nextActions ??
        payload.nextBestActions ??
        payload.next_best_actions ??
        payload.payload?.actions ??
        [];
      const final = { intent: payload.intent ?? payload.payload?.intent, actions };
      if (onDone) onDone(final);
    } catch (e) {
      onError && onError(e);
    }
  };

  es.addEventListener("assist", (e) => handle(e.data));
  es.onmessage = (e) => handle(e.data);
  es.onerror = (e) => { onError && onError(e); es.close(); };

  return () => es.close();
}
