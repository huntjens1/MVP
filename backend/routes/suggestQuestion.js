import { Router } from 'express';
import OpenAI from 'openai';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// NB: zet in Railway/Vercel: OPENAI_API_KEY=<jouw key>

router.post('/api/suggest-question', async (req, res) => {
  try {
    const { transcript } = req.body || {};
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'missing_transcript' });
    }

    // Knip te lange input weg – voorkom 413/over-cost
    const input = transcript.slice(0, 2000);

    const system = `
Je bent een NEDERLANDSE IT-servicedesk coach. 
Geef maximaal 3 korte vervolgvraagd suggesties gebaseerd op ITIL v4 (incident intake).
Stijl: beknopt, concreet, geen uitleg. Alleen vragen.
Voorbeelden: "Wat is de exacte foutmelding?", "Wat veranderde vlak voor het probleem?".
Als er geen duidelijke vervolgvraag is, return een lege lijst.
`;

    // Lean prompt -> kort en goedkoop; past in 'mini' model
    const user = `Samenvatting klant/agent:\n"""${input}"""\n\nGeef 1-3 vervolgvraag-suggesties (NL), in JSON: {"suggestions":["..."]}`;

    // Gebruik een betaalbaar, snel model
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: system.trim() },
        { role: 'user', content: user.trim() },
      ],
      response_format: { type: 'json_object' }, // dwing JSON af
    });

    const raw = resp.choices?.[0]?.message?.content || '{}';
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    let suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    // Post‑filter: max 3, niet leeg, max 120 tekens per item
    suggestions = suggestions
      .map(s => String(s).trim())
      .filter(s => s && s.length <= 120)
      .slice(0, 3);

    return res.json({ suggestions });
  } catch (err) {
    console.error('suggest-question error:', err?.message || err);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
