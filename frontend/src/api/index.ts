const BASE = import.meta.env.VITE_API_BASE_URL;

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

export default {
  wsToken: async () => j(await fetch(`${BASE}/api/ws-token`, { credentials: "include" })),

  ingestTranscript: async (payload: {
    conversation_id: string;
    content: string;
    is_final?: boolean;
    speaker_label?: string;
    speaker?: number;
  }) =>
    j(await fetch(`${BASE}/api/transcripts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    })),

  suggestOnDemand: async (transcript: string) =>
    j<{ suggestions: string[] }>(
      await fetch(`${BASE}/api/suggest-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
        credentials: "include",
      })
    ),

  feedback: async (payload: {
    suggestion_id?: string;
    suggestion_text: string;
    conversation_id: string;
    feedback: number; // 1 of -1
  }) =>
    j(await fetch(`${BASE}/api/ai/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    })),

  summarize: async (payload: { transcript: string }) =>
    j<{ summary: string }>(
      await fetch(`${BASE}/api/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      })
    ),
};
