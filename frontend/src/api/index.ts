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
  priority: "P1" | "P2" | "P3" | "P4";
  ttr_minutes: number;
  impact: "Low" | "Medium" | "High" | "Critical";
  urgency: "Low" | "Medium" | "High" | "Critical";
  category: string;
  ci?: string | null;
  tags?: string[] | null;
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

async function me() {
  try {
    return await json<{ user: User | null }>(`${BASE}/api/me`);
  } catch {
    return { user: null };
  }
}

async function login(email: string, password: string) {
  return await json<{ user: User | null }>(`${BASE}/api/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

async function logout() {
  try {
    await json<unknown>(`${BASE}/api/logout`, { method: "POST" });
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
  // trigger nieuwe suggesties server-side
  try {
    await json(`${BASE}/api/suggest`, {
      method: "POST",
      body: JSON.stringify({ conversation_id, text }),
    });
  } catch {
    /* ignore */
  }
  return { ok: true as const };
}

/* ---------- Assist (NBA/Runbook) – optioneel aanwezig ---------- */
/* Als je backend deze routes nog niet heeft, blijft de UI gewoon leeg. */

function assistStream(conversation_id: string) {
  const url = new URL(`${BASE}/api/assist-stream`);
  url.searchParams.set("conversation_id", conversation_id);
  const es = new EventSource(url.toString(), { withCredentials: true });
  return es;
}

async function assist(conversation_id: string, text: string) {
  try {
    await json(`${BASE}/api/assist`, {
      method: "POST",
      body: JSON.stringify({ conversation_id, text }),
    });
  } catch {
    /* ignore */
  }
  return { ok: true as const };
}

/* ---------- Ticket skeleton (met slimme fallback) ---------- */

async function ticketSkeleton(conversation_id: string, text: string) {
  // 1) Probeer dedicated endpoint (als aanwezig)
  try {
    return await json<{ skeleton: TicketSkeleton }>(`${BASE}/api/ticket-skeleton`, {
      method: "POST",
      body: JSON.stringify({ conversation_id, text }),
    });
  } catch {
    // 2) Fallback via /api/summarize en heuristieken → altijd iets teruggeven
    try {
      const s = await json<{ summary: string }>(`${BASE}/api/summarize`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
      });
      const lower = (s.summary || text || "").toLowerCase();

      const isUrgent =
        /storing|ligt eruit|kritiek|urgent|prod|nood/i.test(s.summary || text);
      const priority: TicketSkeleton["priority"] = isUrgent ? "P2" : "P4";
      const ttr = priority === "P2" ? 240 : 2880;

      const skeleton: TicketSkeleton = {
        title:
          (s.summary || text).split("\n")[0]?.slice(0, 80) ||
          "Supportverzoek",
        description: s.summary || text,
        priority,
        ttr_minutes: ttr,
        impact: isUrgent ? "High" : "Low",
        urgency: isUrgent ? "High" : "Low",
        category: /wachtwoord|login/.test(lower)
          ? "Accounts / Wachtwoord"
          : /mail|outlook|gmail/.test(lower)
          ? "E-mail"
          : /printer|afdruk/.test(lower)
          ? "Printing"
          : "Algemeen",
        ci: null,
        tags: null,
      };
      return { skeleton };
    } catch {
      // 3) Minimalistisch laatste redmiddel
      const skeleton: TicketSkeleton = {
        title: "Supportverzoek",
        description: text,
        priority: "P4",
        ttr_minutes: 2880,
        impact: "Low",
        urgency: "Low",
        category: "Algemeen",
        ci: null,
        tags: null,
      };
      return { skeleton };
    }
  }
}

/* ---------- Default export ---------- */

const api = {
  me,
  login,
  logout,
  wsToken,
  suggest,
  suggestStream,
  assist,
  assistStream,
  ticketSkeleton,
};

export default api;
