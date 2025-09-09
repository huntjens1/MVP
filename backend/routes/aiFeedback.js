// backend/routes/aiFeedback.js
const express = require('express');
const router = express.Router();

/**
 * POST /api/ai-feedback
 * MVP: log feedback (kan later naar DB / analytics pipeline)
 */
router.post('/ai-feedback', async (req, res) => {
  try {
    const {
      conversation_id = null,
      event = null,            // e.g. "suggestion_shown" | "clicked" | "dismissed"
      suggestion_id = null,
      score = null,            // optional numeric score
      comment = null,          // optional free text
      meta = null,             // optional arbitrary object
    } = req.body || {};

    // Productielog (voor nu): schrijf naar stdout
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

    if (!event) {
      // Voor MVP: nooit 4xx op feedback; voorkom ruis in frontend
      return res.status(200).json({ ok: true, note: 'no_event_specified' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[AI_FEEDBACK][ERROR]', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
