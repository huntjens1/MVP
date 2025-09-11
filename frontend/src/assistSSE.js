// Browser-side SSE client voor ASSIST streaming (Next-Best-Actions / RAG e.d.)
//
// Gebruik:
//   import { openAssistStream } from "./assistSSE";
//   const stop = openAssistStream({
//     conversationId,
//     onDelta: (text) => setLiveText((t) => t + text),
//     onDone:  () => console.log("assist stream klaar"),
//     onError: (err) => console.error("assist sse error", err),
//   });
//   // later: stop()

export function openAssistStream({
  conversationId,
  onDelta,
  onDone,
  onError,
}) {
  if (!conversationId) throw new Error("conversationId is vereist");

  // Zorg dat je backend cookie-based auth gebruikt; metCredentials = true is essentieel
  const url = `/api/assist-stream?conversation_id=${encodeURIComponent(conversationId)}`;
  const es = new EventSource(url, { withCredentials: true });

  es.onmessage = (ev) => {
    // Server mag comments/keep-alives sturen; lege data negeren
    if (!ev.data) return;
    if (ev.data === "[DONE]") {
      try { onDone && onDone(); } finally { es.close(); }
      return;
    }

    try {
      // Verwacht payloads zoals: { type:"delta", text:"..." } of { type:"final", ... }
      const payload = JSON.parse(ev.data);

      if (payload && payload.type === "delta" && typeof payload.text === "string") {
        onDelta && onDelta(payload.text);
        return;
      }

      if (payload && payload.type === "final") {
        onDone && onDone(payload);
        es.close();
      }
    } catch (e) {
      onError && onError(e);
    }
  };

  es.onerror = (e) => {
    onError && onError(e);
    es.close();
  };

  // return stop-functie
  return () => es.close();
}
