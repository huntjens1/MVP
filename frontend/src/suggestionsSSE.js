// frontend/src/suggestionsSSE.js
export function openSuggestionsStream({ conversationId, onSuggest, onError }) {
  if (!conversationId) throw new Error("conversationId is vereist");
  const url = `/api/suggestions?conversation_id=${encodeURIComponent(conversationId)}`;
  const es = new EventSource(url, { withCredentials: true });

  const handle = (raw) => {
    try {
      const payload = typeof raw === "string" ? JSON.parse(raw) : raw || {};
      const list =
        payload.suggestions ??
        payload.items ??
        payload.list ??
        payload.payload?.suggestions ??
        (Array.isArray(payload) ? payload : []);
      if (Array.isArray(list)) onSuggest && onSuggest(list);
    } catch (e) {
      onError && onError(e);
    }
  };

  es.addEventListener("suggestions", (e) => handle(e.data));
  es.onmessage = (e) => handle(e.data);
  es.onerror = (e) => { onError && onError(e); es.close(); };

  return () => es.close();
}
