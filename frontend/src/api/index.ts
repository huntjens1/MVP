// frontend/src/api/index.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

export type User = {
  id: string;
  name: string;
  email: string;
};

export type WsTokenResponse = { token: string };

export type TicketSkeleton = {
  title: string;
  description: string;
  summary?: string;            // alias
  short_description?: string;  // alias
  priority: "P1" | "P2" | "P3" | "P4";
  priorityNumber?: number;     // alias
  ttr_minutes?: number;
  ttr_hours?: number;          // alias
  urgency?: "Low" | "Medium" | "High" | "Critical";
  impact?: "Low" | "Medium" | "High" | "Critical";
  ci?: string;
  tags?: string[];
  meta?: Record<string, any>;
};

const BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? "";

async function json<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  // Laat caller zelf bepalen wat te doen bij 404 e.d.
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/* ---------- Auth ---------- */

async function login(email: string, password: string) {
  return await json<{ user: User | null }>(`${BASE}/api/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

async function me() {
  try {
    return await json<{ user: User | null }>(`${BASE}/api/me`);
  } catch {
    return { user: null };
  }
}

async function logout() {
  try {
    await json<{ ok: true }>(`${BASE}/api/logout`, { method: "POST" });
  } catch {
    /* ignore */
  }
  return { ok: true as const };
}

/* ---------- Realtime / WS ---------- */

async function wsToken() {
  return await json<WsTokenResponse>(`${BASE}/api/ws-token`, { method: "POST" });
}

/* ---------- Suggesties (SSE + trigger) ---------- */

function suggestStream(conversation_id: string) {
  const url = new URL(`${BASE}/api/suggestions`);
  url.searchParams.set("conversation_id", conversation_id);
  const es = new EventSource(url.toString(), { withCredentials: true });
  return es;
}

async function suggest(conversation_id: string, text: string) {
  // Backend broadcast via SSE; response bevat { suggestions } maar UI luistert live
  return await json<{ suggestions: Array<{ text: string }> }>(`${BASE}/api/suggest`, {
    method: "POST",
    body: JSON.stringify({ conversation_id, transcript: text }),
  });
}

/* ---------- Assist (SSE + trigger) ---------- */

function assistStream(conversation_id: string) {
  const url = new URL(`${BASE}/api/assist-stream`);
  url.searchParams.set("conversation_id", conversation_id);
  const es = new EventSource(url.toString(), { withCredentials: true });
  return es;
}

async function assist(conversation_id: string, text: string) {
  // Backend broadcast via SSE; response bevat { suggestion } maar UI luistert live
  return await json<{ suggestion?: string }>(`${BASE}/api/assist`, {
    method: "POST",
    body: JSON.stringify({ conversation_id, transcript: text }),
  });
}

/* ---------- Summaries / Ticket ---------- */

async function summarize(text: string) {
  return await json<{ summary: string }>(`${BASE}/api/summarize`, {
    method: "POST",
    body: JSON.stringify({ transcript: text }),
  });
}

async function ticketSkeleton(conversation_id: string, text: string) {
  // Backend kan { ticket } of { skeleton } teruggeven — normaliseer hier
  const r = await json<{ ticket?: TicketSkeleton; skeleton?: TicketSkeleton }>(
    `${BASE}/api/ticket-skeleton`,
    {
      method: "POST",
      body: JSON.stringify({ conversation_id, transcript: text }),
    }
  );
  const ticket = (r.skeleton ?? r.ticket) as TicketSkeleton | undefined;
  if (!ticket) throw new Error("No ticket in response");
  return { ticket };
}

const api = {
  me,
  login,
  logout,
  wsToken,
  suggest,
  suggestStream,
  assist,
  assistStream,
  summarize,
  ticketSkeleton,
};

export default api;
