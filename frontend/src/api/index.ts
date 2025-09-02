// Unified API helper voor CallLogix (frontend).
// - Canonieke endpoints + automatische fallback naar oude alias-routes
// - Sterk getypeerde responses (geen 'unknown' meer)
// - BASE komt uit VITE_API_BASE_URL (bv. https://<railway-backend>)

export type WsTokenResponse = { token: string; expiresIn?: number };
export type SuggestResponse = { suggestions: string[] };
export type SummarizePayload = { transcript: string };
export type SummarizeResponse = { summary: string };

const BASE = (import.meta.env.VITE_API_BASE_URL ?? "") as string;
const API = BASE.replace(/\/$/, ""); // strip trailing slash

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`);
  }
  // Sommige toolchains typeren res.json() als unknown → cast per-call
  return (await res.json()) as T;
}

// --- interne helper met fallback naar alias-pad ---
async function postJson<T>(
  path: string,
  body: unknown,
  aliases: string[] = []
): Promise<T> {
  const url = `${API}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body ?? {}),
    });
    return await asJson<T>(res);
  } catch (e) {
    // Fallback paden proberen (oude routes in jouw bestaande frontend)
    for (const alt of aliases) {
      const altUrl = `${API}${alt}`;
      try {
        const r = await fetch(altUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body ?? {}),
        });
        return await asJson<T>(r);
      } catch {
        /* probeer volgende alias */
      }
    }
    throw e;
  }
}

// ====================== Public API ======================

/** Haal een tijdelijke Deepgram token op. */
export async function wsToken(): Promise<WsTokenResponse> {
  const data = await postJson<Partial<WsTokenResponse>>(
    "/api/ws-token",
    {},
    ["/ws-token"] // alias
  );
  if (!data || typeof data.token !== "string") {
    throw new Error("Invalid ws-token payload");
  }
  return { token: data.token, expiresIn: Number(data.expiresIn ?? 0) };
}

/** On-demand suggesties (NL, ITIL) voor UI. */
export async function suggestOnDemand(
  transcript: string,
  max = 5
): Promise<SuggestResponse> {
  // Canoniek pad + alias voor backward compatibility
  const raw = await postJson<any>(
    "/api/suggest",
    { transcript, max },
    ["/api/suggestQuestion"]
  );

  // Normaliseer: backend kan string[] of [{text:...}] geven
  const list = Array.isArray(raw?.suggestions) ? raw.suggestions : [];
  const texts: string[] = list.map((item: any) =>
    typeof item === "string" ? item : String(item?.text ?? "").trim()
  ).filter(Boolean);

  return { suggestions: texts };
}

/** Feedback voor vraag/suggestie (👍/👎) */
export async function feedback(payload: {
  suggestion_id?: string;          // id van suggestie (optioneel)
  suggestionId?: string;           // alias key
  suggestion_text?: string;        // vrije tekst (indien geen id)
  conversation_id?: string;
  feedback?: -1 | 0 | 1;           // -1=down, 1=up
  vote?: "up" | "down";            // alias key
}): Promise<{ ok: boolean }> {
  // normaliseer keys
  const body: any = {
    suggestion_id: payload.suggestion_id ?? payload.suggestionId,
    suggestion_text: payload.suggestion_text,
    conversation_id: payload.conversation_id,
  };
  if (typeof payload.feedback === "number") {
    body.feedback = Math.max(-1, Math.min(1, payload.feedback));
  } else if (payload.vote) {
    body.feedback = payload.vote === "up" ? 1 : -1;
  } else {
    body.feedback = 0;
  }

  const res = await postJson<{ ok: boolean }>(
    "/api/feedback",
    body,
    ["/api/ai/feedback"] // alias pad
  );
  return { ok: !!res?.ok };
}

/** Samenvatting voor review-modal (soft-fail: summary = "") */
export async function summarize(
  payload: SummarizePayload
): Promise<SummarizeResponse> {
  const data = await postJson<Partial<SummarizeResponse>>(
    "/api/summarize",
    payload,
    ["/api/ai/summarize"] // alias pad
  );
  return { summary: String(data?.summary ?? "") };
}

// Optioneel default export als object voor bestaande imports
const api = {
  wsToken,
  suggestOnDemand,
  feedback,
  summarize,
};
export default api;
