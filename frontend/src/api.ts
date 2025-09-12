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

function buildUrl(path: string, params?: Record<string, any>) {
  // path mag '/api/...' of 'api/...' zijn, of een absolute http(s) URL
  const isAbs = /^https?:\/\//i.test(path);
  const base = isAbs ? "" : BASE.replace(/\/+$/, "");
  const p = isAbs ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const url = new URL(p);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function asJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try { return JSON.parse(text) as T; } catch { return {} as T; }
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const payload = await asJson<any>(res).catch(() => ({}));
    const message = payload?.error || `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return (await asJson<T>(res)) as T;
}

// -------- Generieke HTTP helpers (quick wins voor admin/analytics/etc.) --------
export async function get<T>(path: string, params?: Record<string, any>) {
  return await request<T>(buildUrl(path, params));
}
export async function post<T>(path: string, body?: any) {
  return await request<T>(buildUrl(path), { method: "POST", body: body ? JSON.stringify(body) : undefined });
}
export async function patch<T>(path: string, body?: any) {
  return await request<T>(buildUrl(path), { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
}
export async function put<T>(path: string, body?: any) {
  return await request<T>(buildUrl(path), { method: "PUT", body: body ? JSON.stringify(body) : undefined });
}
export async function del<T>(path: string, params?: Record<string, any>) {
  return await request<T>(buildUrl(path, params), { method: "DELETE" });
}

// -------- Auth --------
async function login(email: string, password: string) {
  return await post<{ user: User | null }>("/api/login", { email, password });
}

async function me() {
  try {
    return await get<{ user: User | null }>("/api/me");
  } catch {
    return { user: null };
  }
}

async function logout() {
  try { await post<{ ok: true }>("/api/logout"); } catch {}
  return { ok: true as const };
}

// -------- Realtime / WS --------
async function wsToken() {
  return await post<WsTokenResponse>("/api/ws-token");
}

// -------- SSE + triggers --------
function suggestStream(conversation_id: string) {
  return new EventSource(buildUrl("/api/suggestions", { conversation_id }), { withCredentials: true });
}

async function suggest(conversation_id: string, transcript: string) {
  return await post<{ suggestions: Array<{ text: string }> }>("/api/suggest", { conversation_id, transcript });
}

function assistStream(conversation_id: string) {
  return new EventSource(buildUrl("/api/assist-stream", { conversation_id }), { withCredentials: true });
}

async function assist(conversation_id: string, transcript: string) {
  return await post<{ suggestion?: string }>("/api/assist", { conversation_id, transcript });
}

// -------- Summaries / Ticket --------
async function summarize(transcript: string) {
  return await post<{ summary: string }>("/api/summarize", { transcript });
}

async function ticketSkeleton(conversation_id: string, transcript: string, overrides?: TicketOverrides) {
  const payload: any = { conversation_id, transcript, ...(overrides || {}) };
  const r = await post<{ ticket?: TicketSkeleton; skeleton?: TicketSkeleton }>("/api/ticket-skeleton", payload);
  const ticket = (r.skeleton ?? r.ticket) as TicketSkeleton | undefined;
  if (!ticket) throw new Error("No ticket in response");
  return { ticket };
}

// -------- Backwards-compat (oude API naam) --------
async function ingestTranscript(payload: { conversation_id: string; content: string }) {
  try {
    await Promise.all([suggest(payload.conversation_id, payload.content), assist(payload.conversation_id, payload.content)]);
  } catch { /* no-op */ }
  return { ok: true as const };
}

// -------- Analytics (wrapper; backend route kan optioneel zijn) --------
async function analyticsOverview(params?: { from?: string; to?: string }) {
  // Probeert /api/analytics/overview; als je backend een andere route gebruikt kun je dat hier 1 plek wijzigen.
  return await get<any>("/api/analytics/overview", params);
}

// -------- Default export --------
const api = {
  // generieke helpers
  get, post, patch, put, del,
  // auth
  me, login, logout,
  // ws
  wsToken,
  // llm/sse
  suggest, suggestStream, assist, assistStream, summarize, ticketSkeleton,
  // compat
  ingestTranscript,
  // analytics
  analyticsOverview,
};

export default api;
