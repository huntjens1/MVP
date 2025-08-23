const BASE = import.meta.env.VITE_API_BASE_URL;

async function j(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const api = {
  wsToken: () => j('POST', '/api/ws-token'),
  ingestTranscript: (payload: { conversation_id: string; content: string; is_final?: boolean; speaker_label?: string; speaker?: number; }) =>
    j('POST', '/api/transcripts/ingest', payload),
  suggestOnDemand: (transcript: string) => j('POST', '/api/suggest-question', { transcript }),
  feedback: (payload: { suggestion_id?: string; conversation_id: string; feedback: -1|0|1; suggestion_text?: string }) =>
    j('POST', '/api/ai-feedback', payload),
  analyticsOverview: () => j('GET', '/api/analytics/overview')
};

export default api;
