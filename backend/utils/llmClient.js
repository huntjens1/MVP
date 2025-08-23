import OpenAI from 'openai';
import { maskPII } from './piiMasker.js';

let _openai = null;
function getOpenAI() {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;           // <-- geen crash meer
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

export async function suggestQuestions({ transcript }) {
  const client = getOpenAI();
  if (!client) {
    // In dev zonder key: geef lege suggesties terug i.p.v. crashen
    return '';
    // Wil je liever hard failen:
    // throw new Error('OPENAI_API_KEY ontbreekt (server-side).');
  }

  const masked = maskPII((transcript || '').slice(-3000));
  const prompt = `Jij bent een ITIL v4 agent-assistent.
Taken:
1) Geef maximaal 3 concrete, korte vervolgvragen (bullets).
2) Bewaak volledigheid: caller, service/CI, impact, urgentie.
3) Antwoord in het Nederlands, zonder PII.
Transcript laatste 60s:
"""${masked}"""`;

  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'Je helpt servicedesk agents volgens ITIL v4.' },
      { role: 'user', content: prompt }
    ],
    timeout: 8000
  });

  return resp.choices?.[0]?.message?.content || '';
}
