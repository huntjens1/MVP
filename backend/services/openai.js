const OPENAI_API = 'https://api.openai.com/v1';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

async function callOpenAIChat(messages, { temperature = 0.2, max_tokens = 400 } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const res = await fetch(`${OPENAI_API}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      max_tokens,
      messages
    })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI chat failed: ${res.status} ${txt}`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '';
}

async function summarizeTranscriptNL(transcript) {
  if (!transcript || !String(transcript).trim()) return '';
  const system = 'Vat het gesprek samen in NL in max 5 regels. Noem indien mogelijk categorie, prioriteit, impact. Geen PII.';
  return await callOpenAIChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: String(transcript) }
    ],
    { temperature: 0.1, max_tokens: 300 }
  );
}

function robustJsonParseMaybeArray(text) {
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  const s2 = text.indexOf('{');
  const e2 = text.lastIndexOf('}');
  if (s2 >= 0 && e2 > s2) {
    try {
      const obj = JSON.parse(text.slice(s2, e2 + 1));
      if (Array.isArray(obj)) return obj;
      if (Array.isArray(obj.items)) return obj.items;
    } catch {}
  }
  return [];
}

async function generateSuggestionsNL({ transcript, max = 5 }) {
  if (!transcript || !String(transcript).trim()) return [];
  const system =
    'Je bent een ITIL-v4 coach. Genereer korte, concrete NL-vragen die een servicedesk agent NU kan stellen. ' +
    'Voeg per vraag een ITIL-klasse toe (Incident/Service Request/Change/Problem) en optionele categorie. ' +
    'Output ALLEEN JSON array van {id, text, itil:{type, category?}, priority}. Geen uitleg. Max 120 tekens per vraag.';
  const content = await callOpenAIChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: `Transcript:\n\n${String(transcript)}\n\nMax items: ${max}` }
    ],
    { temperature: 0.2, max_tokens: 800 }
  );

  const arr = robustJsonParseMaybeArray(content);
  const out = (arr || []).map((x, i) => ({
    id: String(x?.id ?? `sg-${Date.now()}-${i}`),
    text: String(x?.text ?? '').slice(0, 180),
    itil: {
      type: String(x?.itil?.type ?? 'Incident'),
      category: x?.itil?.category ?? undefined,
    },
    priority: Math.max(1, Math.min(100, Number(x?.priority ?? 50))),
  }));
  return out.slice(0, max);
}

module.exports = {
  summarizeTranscriptNL,
  generateSuggestionsNL,
};
