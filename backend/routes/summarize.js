// backend/routes/summarize.js
const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/summarize
 * Body: { conversation_id, text }
 * Retourneert een korte samenvatting + bullets met acties.
 */
router.post('/summarize', async (req, res) => {
  const { conversation_id, text } = req.body || {};
  console.log('[summarize] request', {
    conversation_id,
    textLen: text?.length,
  });

  if (!text) return res.status(400).json({ error: 'text_required' });

  try {
    const prompt = `Vat de volgende NL-gespreksinhoud beknopt samen (3-5 zinnen) 
en geef daarna 3 puntsgewijze Next-Best-Actions voor de agent.

Tekst:
${text}`;

    const rsp = await openai.chat.completions.create({
      model: process.env.SUMMARY_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const content = rsp.choices?.[0]?.message?.content || '';
    console.log('[summarize] tokens', { contentLen: content.length });

    return res.json({ ok: true, summary: content });
  } catch (err) {
    console.error('[summarize] error', err);
    return res.status(500).json({ error: 'summarize_failed' });
  }
});

module.exports = router;
