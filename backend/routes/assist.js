// backend/routes/assist.js
const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { emit: emitAssist, emitToUser: emitAssistToUser } = require('../streams/assistSSE');
const { generateSuggestionsNL } = require('../services/openai');

const router = express.Router();

// POST /api/assist
// Body: { conversation_id, transcript?, context? }
router.post('/assist', requireAuth, async (req, res) => {
  const { conversation_id, transcript = '', context = {} } = req.body || {};
  try {
    const suggestions = await generateSuggestionsNL(transcript, context, 3);

    const payload = {
      conversation_id: conversation_id || null,
      intent: suggestions?.[0]?.itil?.type || 'Follow-up',
      next_best_actions: suggestions.map(s => s.text).slice(0, 3),
      runbook_steps: [],
    };

    // 1) Emit naar expliciete conversatie (indien aanwezig)
    if (conversation_id) emitAssist(conversation_id, payload);

    // 2) Altijd ook naar alle actieve conversaties van de ingelogde user
    if (req.user?.id) emitAssistToUser(req.user.id, payload);

    return res.json({ suggestion: suggestions?.[0]?.text || '' });
  } catch (err) {
    console.error('[assist] error', { error: err?.message });
    return res.status(500).json({ error: 'assist_failed' });
  }
});

module.exports = router;
