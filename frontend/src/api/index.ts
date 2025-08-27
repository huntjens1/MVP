// src/api/index.ts
// Eenduidige API helper met alle gebruikte endpoints, incl. summarize.

const BASE = import.meta.env.VITE_API_BASE_URL as string;

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`);
  }
  return (await res.json()) as T;
}

export type WsTokenResp = { token: string };

export type SuggestResp = { suggestions: string[] };

export type FeedbackPayload = {
  suggestion_id?: string;
  suggestion_text: string;
  conversation_id: string;
  feedback: 1 | -1;
};

export type IngestPayload = {
  conversation_id: string;
  content: string;
  is_final?: boolean;
  speaker_label?: string;
  speaker?: number;
};

export type SummarizePayload = { transcript: string };
export type SummarizeResp = { summary: string };

const api = {
  /** Token voor WS /ws/mic */
  wsToken: async (): Promise<WsTokenResp> =>
    asJson(await fetch(`${BASE}/api/ws-token`, { credentials: "include" })),

  /** Transcriptregels opslaan (optioneel) */
  ingestTranscript: async (payload: IngestPayload) =>
    asJson(
      await fetch(`${BASE}/api/transcripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      })
    ),

  /** Ad-hoc AI-vraagsuggesties */
  suggestOnDemand: async (transcript: string): Promise<SuggestResp> =>
    asJson(
      await fetch(`${BASE}/api/suggest-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
        credentials: "include",
      })
    ),

  /** Duimpje voor suggestie of gestelde vraag */
  feedback: async (payload: FeedbackPayload) =>
    asJson(
      await fetch(`${BASE}/api/ai/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      })
    ),

  /** Samenvatting voor review-modal */
  summarize: async (payload: SummarizePayload): Promise<SummarizeResp> =>
    asJson(
      await fetch(`${BASE}/api/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      })
    ),
};

export default api;
