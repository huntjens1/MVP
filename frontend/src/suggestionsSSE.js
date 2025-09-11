// Browser-side SSE client voor live Suggesties (Next Best Question e.d.)
//
// Gebruik:
//   import { openSuggestionsStream } from "./suggestionsSSE";
//   const stop = openSuggestionsStream({
//     conversationId,
//     onSuggest: (arr) => setSuggestions(arr), // of append per item
//     onError: (err) => console.error("suggestions sse error", err),
//   });
//   // later: stop()

export function openSuggestionsStream({
  conversationId,
  onSuggest,
  onError,
}) {
  if (!conversationId) throw new Error("conversationId is vereist");

  const url = `/api/suggestions?conversation_id=${encodeURIComponent(conversationId)}`;
  const es = new EventSource(url, { withCredentials: true });

  es.onmessage = (ev) => {
    if (!ev.data) return;
    if (ev.data === "[DONE]") {
      es.close();
      return;
    }

    try {
      // Mogelijke payloads:
      //  { suggestions: string[] }
      //  { type: "suggestion", text: "..." }
      const payload = JSON.parse(ev.data);

      if (Array.isArray(payload?.suggestions)) {
        onSuggest && onSuggest(payload.suggestions);
        return;
      }
      if (payload?.type === "suggestion" && typeof payload.text === "string") {
        onSuggest && onSuggest([payload.text]);
      }
    } catch (e) {
      onError && onError(e);
    }
  };

  es.onerror = (e) => {
    onError && onError(e);
    es.close();
  };

  return () => es.close();
}
