const BASE = import.meta.env.VITE_API_BASE_URL;

async function j(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    let text = '';
    try { text = await res.text(); } catch {}
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Nieuwe, getypeerde helpers (voorkeur) */
const api = {
  wsToken: () => j('POST', '/api/ws-token'),
  ingestTranscript: (payload: {
    conversation_id: string; content: string; is_final?: boolean; speaker_label?: string; speaker?: number;
  }) => j('POST', '/api/transcripts/ingest', payload),
  suggestOnDemand: (transcript: string) => j('POST', '/api/suggest-question', { transcript }),
  feedback: (payload: { suggestion_id?: string; conversation_id: string; feedback: -1|0|1; suggestion_text?: string }) =>
    j('POST', '/api/ai-feedback', payload),
  analyticsOverview: () => j('GET', '/api/analytics/overview'),

  /** Backwards-compatibility voor bestaande code */
  get:  (path: string) => j('GET', path),
  post: (path: string, body?: any) => j('POST', path, body),
  patch:(path: string, body?: any) => j('PATCH', path, body),
  del:  (path: string) => j('DELETE', path)
};

export default api;
