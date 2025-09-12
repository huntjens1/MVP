// frontend/src/api/index.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

// -------- Types --------
export type User = { id: string; name: string; email: string };

export type WsTokenResponse = { token: string };

export type TicketSkeleton = {
  title: string;
  description: string;
  summary?: string;
  short_description?: string;
  priority: "P1" | "P2" | "P3" | "P4";
  priorityNumber?: number;
  ttr_minutes?: number;
  ttr_hours?: number;
  urgency?: "Low" | "Medium" | "High" | "Critical";
  impact?: "Low" | "Medium" | "High" | "Critical";
  ci?: string;
  tags?: string[];
  meta?: Record<string, any>;
};

export type TicketOverrides = Partial<
  Pick<TicketSkeleton, "urgency" | "impact" | "ci" | "tags" | "priority"> & { category?: string }
>;

// -------- Helpers --------
const BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? "";

async function json<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

// -------- Auth --------
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
  } catch {}
  return { ok: true as const };
}

// -------- Realtime / WS --------
async function wsToken() {
  return await json<WsTokenResponse>(`${BASE}/api/ws-token`, { method: "POST" });
}

// -------- SSE + triggers --------
function suggestStream(conversation_id: string) {
  const url = new URL(`${BASE}/api/suggestions`);
  url.searchParams.set("conversation_id", conversation_id);
  return new EventSource(url.toString(), { withCredentials: true });
}

async function suggest(conversation_id: string, transcript: string) {
  return await json<{ suggestions: Array<{ text: string }> }>(`${BASE}/api/suggest`, {
    method: "POST",
    body: JSON.stringify({ conversation_id, transcript }),
  });
}

function assistStream(conversation_id: string) {
  const url = new URL(`${BASE}/api/assist-stream`);
  url.searchParams.set("conversation_id", conversation_id);
  return new EventSource(url.toString(), { withCredentials: true });
}

async function assist(conversation_id: string, transcript: string) {
  return await json<{ suggestion?: string }>(`${BASE}/api/assist`, {
    method: "POST",
    body: JSON.stringify({ conversation_id, transcript }),
  });
}

// -------- Summaries / Ticket --------
async function summarize(transcript: string) {
  return await json<{ summary: string }>(`${BASE}/api/summarize`, {
    method: "POST",
    body: JSON.stringify({ transcript }),
  });
}

async function ticketSkeleton(conversation_id: string, transcript: string, overrides?: TicketOverrides) {
  const payload: any = { conversation_id, transcript, ...(overrides || {}) };
  const r = await json<{ ticket?: TicketSkeleton; skeleton?: TicketSkeleton }>(
    `${BASE}/api/ticket-skeleton`,
    { method: "POST", body: JSON.stringify(payload) }
  );
  const ticket = (r.skeleton ?? r.ticket) as TicketSkeleton | undefined;
  if (!ticket) throw new Error("No ticket in response");
  return { ticket };
}

// -------- Backwards-compat (oude API naam) --------
// Bestaat soms nog elders in de app; laat het leven als no-op wrapper.
async function ingestTranscript(payload: { conversation_id: string; content: string }) {
  try {
    await Promise.all([
      suggest(payload.conversation_id, payload.content),
      assist(payload.conversation_id, payload.content),
    ]);
  } catch {
    // noop
  }
  return { ok: true as const };
}

// -------- Default export --------
const api = {
  me,
  login,
  logout,
  wsToken,
  // realtime
  suggest,
  suggestStream,
  assist,
  assistStream,
  // llm
  summarize,
  ticketSkeleton,
  // compat
  ingestTranscript,
};

export default api;
