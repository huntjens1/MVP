// backend/routes/assist.js
const express = require('express');
const router = express.Router();

// Gebruik je eigen OpenAI client/module hier.
// We laten het generiek zodat je bestaande implementatie intact blijft.
// Zorg dat process.env.OPENAI_API_KEY is gezet.
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Kleine helper om veilige strings te maken
const toStr = (v) => (typeof v === 'string' ? v : JSON.stringify(v));

/**
 * POST /api/assist
 * Body: { conversation_id, text, role? }
 * Doel: genereer "assistance" (bijv. korte vervolgvraag/antwoord/actie)
 * en stuur optioneel ook een SSE-event naar assist-stream (indien aanwezig).
 */
router.post('/assist', async (req, res) => {
  const { conversation_id, text, role } = req.body || {};
  console.log('[assist] request', { conversation_id, role, textLen: text?.length });

  if (!conversation_id || !text) {
    return res.status(400).json({ error: 'conversation_id_and_text_required' });
  }

  try {
    // Eenvoudige prompt – pas aan naar jouw bestaande werkwijze
    const prompt = `Context (NL): ${toStr(text)}\n
Geef één korte, nuttige vervolgactie of -vraag voor de agent (max 1 zin).`;

    const rsp = await openai.chat.completions.create({
      model: process.env.ASSIST_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    });

    const suggestion =
      rsp.choices?.[0]?.message?.content?.trim() || 'Geen suggestie beschikbaar.';

    console.log('[assist] generated', { suggestionLen: suggestion.length });

    // Eventueel pushen naar je SSE kanaal
    try {
      const { emitToConversation } = require('../streams/assistSSE'); // jouw bestand
      emitToConversation &&
        emitToConversation(conversation_id, { type: 'assist', text: suggestion });
    } catch (sseErr) {
      // Niet blocking
      console.warn('[assist] SSE emit skipped:', sseErr?.message || sseErr);
    }

    return res.json({ ok: true, suggestion });
  } catch (err) {
    console.error('[assist] error', err);
    return res.status(500).json({ error: 'assist_failed' });
  }
});

module.exports = router;
