export type WsTokenResponse = { token: string; expiresIn?: number };
export type SuggestResponse = { suggestions: string[] };
export type SummarizePayload = { transcript: string };
export type SummarizeResponse = { summary: string };
export type LoginResponse = { user: any; token?: string };

const BASE = (import.meta.env.VITE_API_BASE_URL ?? "") as string;
const API = BASE.replace(/\/$/, "");
const TOKEN_KEY = "clx_token";

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
function setToken(t?: string) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

function jsonHeaders(extra?: Record<string, string>) {
  const h: Record<string, string> = { "Content-Type": "application/json", ...(extra || {}) };
  const t = getToken();
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status} ${res.statusText}`;
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j = await res.json();
        if (j?.error || j?.message) {
          msg = `${j?.error ?? ""}${j?.message ? `: ${j.message}` : ""}`.trim() || msg;
        } else {
          msg = JSON.stringify(j);
        }
      } else {
        const t = await res.text();
        if (t) msg = `${msg} ${t}`;
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown, aliases: string[] = []): Promise<T> {
  const url = `${API}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: jsonHeaders(),
      credentials: "include",
      body: JSON.stringify(body ?? {}),
    });
    return await asJson<T>(res);
  } catch (e) {
    for (const alt of aliases) {
      const altUrl = `${API}${alt}`;
      try {
        const r = await fetch(altUrl, {
          method: "POST",
          headers: jsonHeaders(),
          credentials: "include",
          body: JSON.stringify(body ?? {}),
        });
        return await asJson<T>(r);
      } catch { /* try next alias */ }
    }
    throw e;
  }
}

async function getJson<T>(path: string, aliases: string[] = []): Promise<T> {
  const url = `${API}${path}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: jsonHeaders(),
      credentials: "include",
    });
    return await asJson<T>(res);
  } catch (e) {
    for (const alt of aliases) {
      const altUrl = `${API}${alt}`;
      try {
        const r = await fetch(altUrl, {
          method: "GET",
          headers: jsonHeaders(),
          credentials: "include",
        });
        return await asJson<T>(r);
      } catch { /* try next alias */ }
    }
    throw e;
  }
}

/** ===== Public API ===== */
export async function wsToken(): Promise<WsTokenResponse> {
  const data = await postJson<Partial<WsTokenResponse>>("/api/ws-token", {}, ["/ws-token"]);
  if (!data || typeof data.token !== "string") throw new Error("Invalid ws-token payload");
  return { token: data.token, expiresIn: Number(data.expiresIn ?? 0) };
}

export async function suggestOnDemand(transcript: string, max = 5): Promise<SuggestResponse> {
  const raw = await postJson<any>("/api/suggest", { transcript, max }, ["/api/suggestQuestion"]);
  const list = Array.isArray(raw?.suggestions) ? raw.suggestions : [];
  const texts: string[] = list
    .map((item: any) => (typeof item === "string" ? item : String(item?.text ?? "").trim()))
    .filter(Boolean);
  return { suggestions: texts };
}

export async function feedback(payload: {
  suggestion_id?: string; suggestionId?: string; suggestion_text?: string; conversation_id?: string;
  feedback?: -1 | 0 | 1; vote?: "up" | "down";
}): Promise<{ ok: boolean }> {
  const body: any = {
    suggestion_id: payload.suggestion_id ?? payload.suggestionId,
    suggestion_text: payload.suggestion_text,
    conversation_id: payload.conversation_id,
  };
  if (typeof payload.feedback === "number") body.feedback = Math.max(-1, Math.min(1, payload.feedback));
  else if (payload.vote) body.feedback = payload.vote === "up" ? 1 : -1;
  else body.feedback = 0;
  const res = await postJson<{ ok: boolean }>("/api/feedback", body, ["/api/ai/feedback"]);
  return { ok: !!res?.ok };
}

export async function summarize(payload: SummarizePayload): Promise<SummarizeResponse> {
  const data = await postJson<Partial<SummarizeResponse>>("/api/summarize", payload, ["/api/ai/summarize"]);
  return { summary: String(data?.summary ?? "") };
}

export async function me(): Promise<{ user: any }> {
  return await getJson<{ user: any }>("/api/me");
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await postJson<LoginResponse>("/api/login", { email, password });
  if (data?.token) setToken(data.token);      // <-- token opslaan (Bearer)
  return data;
}

export async function logout(): Promise<void> {
  try { await postJson("/api/logout", {}); } catch { /* ignore */ }
  setToken(undefined);
}

const api = { wsToken, suggestOnDemand, feedback, summarize, me, login, logout };
export default api;
