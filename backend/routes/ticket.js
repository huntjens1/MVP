// backend/routes/ticket.js
const express = require('express');
const router = express.Router();

/**
 * POST /api/ticket-skeleton
 * Body: { conversation_id?, title?, description?, priority?, ci?, impact? }
 * Bouwt een skeleton payload voor je ticketing UI. 
 * Laat bestaande velden intact en vult defaults in waar nodig.
 */
router.post('/ticket-skeleton', async (req, res) => {
  try {
    const {
      conversation_id,
      title,
      description,
      priority,
      ci,
      impact,
      tags,
    } = req.body || {};

    console.log('[ticket] skeleton request', {
      conversation_id,
      hasTitle: !!title,
      hasDescription: !!description,
    });

    // Defaults die overeenkomen met je UI
    const payload = {
      title: title || 'Supportverzoek',
      priority: priority || 'P4 (TTR ~2880m)',
      impact: impact || 'Low / Low',
      category: 'Algemeen',
      ci: ci || 'n.b.',
      tags: Array.isArray(tags) ? tags : [],
      description: description || '—',
      meta: { conversation_id },
    };

    return res.json({ ok: true, ticket: payload });
  } catch (err) {
    console.error('[ticket] skeleton error', err);
    return res.status(500).json({ error: 'ticket_skeleton_failed' });
  }
});

module.exports = router;
