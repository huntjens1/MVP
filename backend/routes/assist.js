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

    // Normaliseer “actions” keys voor brede UI-compatibiliteit
    const actions = suggestions.map(s => s.text).slice(0, 3);
    const intent  = suggestions?.[0]?.itil?.type || 'Follow-up';

    const payload = {
      type: 'assist',
      conversation_id: conversation_id || null,
      intent,

      // aliases zodat elke UI iets kan vinden:
      actions,                      // veel UIs lezen deze
      nextActions: actions,         // camelCase
      nextBestActions: actions,     // camelCase gebruikt in sommige builds
      next_best_actions: actions,   // snake_case (bestaand)
      runbook_steps: [],

      // optionele “envelope” voor UIs die data.payload verwachten
      payload: {
        intent,
        actions,
      },
    };

    // 1) Emit naar expliciete conversatie (indien aanwezig)
    if (conversation_id) emitAssist(conversation_id, payload);

    // 2) Altijd ook naar alle actieve conversaties van de ingelogde user
    if (req.user?.id) emitAssistToUser(req.user.id, payload);

    console.debug('[assist] emitted', {
      conversation_id: conversation_id || null,
      actions: actions.length,
      user: req.user?.email,
    });

    return res.json({ suggestion: suggestions?.[0]?.text || '' });
  } catch (err) {
    console.error('[assist] error', { error: err?.message });
    return res.status(500).json({ error: 'assist_failed' });
  }
});

module.exports = router;
