// src/api/index.ts
const BASE = import.meta.env.VITE_API_BASE_URL as string;

// ---------- Types ----------
export type WsTokenResponse = { token: string };

export type SuggestEvent = {
  conversation_id: string;
  suggestions: string[];
  ts: number;
};

export type AssistEvent = {
  conversation_id: string;
  intent: string;
  next_best_actions: string[];
  runbook_steps: string[];
  ts: number;
};

export type TicketSkeleton = {
  title: string;
  category: string;
  impact: "Low" | "Medium" | "High" | "Critical";
  urgency: "Low" | "Medium" | "High" | "Critical";
  priority: "P1" | "P2" | "P3" | "P4";
  ttr_minutes: number;
  ci: string | null;
  tags: string[];
  description: string;
};

// ---------- Helpers ----------
async function post<T>(path: string, body: any): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`${path} ${r.status} ${txt}`);
  }
  return r.json() as Promise<T>;
}

function sse(path: string): EventSource {
  return new EventSource(`${BASE}${path}`, { withCredentials: true });
}

// ---------- API ----------
const api = {
  wsToken: async (): Promise<WsTokenResponse> => post("/api/ws-token", {}),

  // Suggesties (SSE + trigger)
  suggest: (conversation_id: string, text: string) =>
    post<SuggestEvent>("/api/suggest", { conversation_id, text }),
  suggestStream: (conversation_id: string) =>
    sse(`/api/suggest/stream?conversation_id=${encodeURIComponent(conversation_id)}`),

  // Next-Best-Action / intent (SSE + trigger)
  assist: (conversation_id: string, text: string) =>
    post<AssistEvent>("/api/assist", { conversation_id, text }),
  assistStream: (conversation_id: string) =>
    sse(`/api/assist/stream?conversation_id=${encodeURIComponent(conversation_id)}`),

  // Ticket skeleton (ITIL)
  ticketSkeleton: (conversation_id: string, text: string) =>
    post<{ conversation_id: string; skeleton: TicketSkeleton; ts: number }>(
      "/api/ticket/skeleton",
      { conversation_id, text }
    ),
};

export default api;
export { api };
