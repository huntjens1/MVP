import OpenAI from 'openai';
import { maskPII } from './piiMasker.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function suggestQuestions({ transcript }) {
  const masked = maskPII((transcript || '').slice(-3000));
  const prompt = `Jij bent een ITIL v4 agent-assistent.
Taken:
1) Geef maximaal 3 concrete, korte vervolgvragen (bullets).
2) Bewaak volledigheid: caller, service/CI, impact, urgentie.
3) Antwoord in het Nederlands, zonder PII.
Transcript laatste 60s:
"""${masked}"""`;

  const resp = await openai.chat.completions.create({
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
