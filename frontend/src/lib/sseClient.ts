// frontend/src/lib/sseClient.ts
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "";

/** Open suggestions SSE */
export function openSuggestionsStream(conversationId: string): EventSource {
  const url = new URL(`${API_BASE}/api/suggestions`);
  url.searchParams.set("conversation_id", conversationId);
  const es = new EventSource(url.toString(), { withCredentials: true });
  return es;
}

/** Open assist SSE */
export function openAssistStream(conversationId: string): EventSource {
  const url = new URL(`${API_BASE}/api/assist-stream`);
  url.searchParams.set("conversation_id", conversationId);
  const es = new EventSource(url.toString(), { withCredentials: true });
  return es;
}
