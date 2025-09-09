// backend/routes/aiFeedback.js
const express = require('express');
const router = express.Router();

/**
 * POST /api/ai-feedback
 * Wordt aangeroepen door de frontend om AI-gerelateerde feedback op te slaan
 * (bijv. thumbs up/down op een suggestie, opmerking, ranking, etc.).
 *
 * Body (alles optioneel; we vangen defensief af voor MVP):
 * {
 *   conversation_id?: string,
 *   event?: string,          // bijv. "suggestion_like" | "suggestion_dislike" | ...
 *   suggestion_id?: string,
 *   score?: number,          // bijv. -1, 0, 1 of 1..5
 *   comment?: string,
 *   meta?: object
 * }
 */
router.post('/ai-feedback', async (req, res) => {
  try {
    const {
      conversation_id = null,
      event = null,
      suggestion_id = null,
      score = null,
      comment = null,
      meta = null,
    } = (req.body || {});

    // Voor nu loggen we dit (MVP). Later kun je dit wegschrijven naar DB / analytics.
    console.log('[AI_FEEDBACK]', {
      ts: new Date().toISOString(),
      conversation_id,
      event,
      suggestion_id,
      score,
      comment,
      meta,
      ua: req.headers['user-agent'] || null,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
    });

    // Minimalistische validatie; nooit 500 teruggeven op user input
    if (!event) {
      return res.status(200).json({ ok: true, note: 'no_event_specified' });
    }

    // Simpel ACK voor MVP
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[AI_FEEDBACK][ERROR]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
