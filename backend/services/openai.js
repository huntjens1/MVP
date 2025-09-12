// backend/services/openai.js
// OpenAI helpers met nette defaults en timeouts.
const MODEL_DEFAULT = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ASSIST_MODEL  = process.env.ASSIST_MODEL  || MODEL_DEFAULT;
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || MODEL_DEFAULT;
const OPENAI_API    = 'https://api.openai.com/v1';
const TIMEOUT_MS    = Number(process.env.OPENAI_TIMEOUT_MS || 20_000);

function withTimeout(promise, ms, tag) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${tag || 'timeout'}_${ms}ms`)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

async function openAIChat({ model, messages, temperature = 0.3, max_tokens = 400 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const body = JSON.stringify({ model, messages, temperature, max_tokens });
  const req = fetch(`${OPENAI_API}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body,
  });
  const res = await withTimeout(req, TIMEOUT_MS, 'openai');
  if (!res.ok) {
    const t = await safeText(res);
    throw new Error(`openai_http_${res.status}: ${t}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  return String(content);
}

function safeText(res) {
  return res.text().then(t => t).catch(() => '');
}

// ---- Business helpers ----

async function summarizeTranscriptNL(transcript, context = {}) {
  const sys = [
    'Je bent een Nederlandse service desk-assistent (ITILv4).',
    'Geef een korte, feitelijke samenvatting (max ~120 woorden) en een bulletlijst met acties.',
  ].join(' ');
  const user = [
    `Transcript (NL):\n${transcript}`,
    context?.notes ? `Context: ${context.notes}` : '',
  ].filter(Boolean).join('\n\n');

  const content = await openAIChat({
    model: SUMMARY_MODEL,
    temperature: 0.2,
    max_tokens: 350,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
  });

  return content.trim();
}

async function generateSuggestionsNL(transcript, context = {}, max = 3) {
  const sys = [
    'Je bent een Nederlandse servicedesk-coach.',
    'Genereer beknopte vervolgvraag/actie in 1 zin.',
    'Optioneel: label met { "itil": { "type": "Incident|Service Request|Change" }, "priority": 1-100 }',
  ].join(' ');
  const user = [
    `Transcript (NL):\n${transcript}`,
    context?.notes ? `Context: ${context.notes}` : '',
  ].filter(Boolean).join('\n\n');

  const content = await openAIChat({
    model: ASSIST_MODEL,
    temperature: 0.4,
    max_tokens: 380,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
  });

  // Parseer eenvoudige lijstjes of JSON-achtige bullets
  const lines = content
    .split('\n')
    .map(s => s.replace(/^[\-\*\d\.\)\s]+/, '').trim())
    .filter(Boolean);

  const out = lines.slice(0, max).map(x => ({
    text: String(x).slice(0, 180),
    itil: { type: guessType(x) },
    priority: 50,
  }));

  return out;
}

function guessType(s='') {
  s = s.toLowerCase();
  if (s.includes('aanvraag') || s.includes('aanmaken') || s.includes('toegang')) return 'Service Request';
  if (s.includes('wijzig') || s.includes('change') || s.includes('implement')) return 'Change';
  return 'Incident';
}

module.exports = {
  summarizeTranscriptNL,
  generateSuggestionsNL,
};
