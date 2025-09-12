// backend/routes/suggestions.js
// - GET  /api/suggestions?conversation_id=...   ← SSE subscribe
// - POST /api/suggest                            ← Genereert suggestions en broadcast

const express = require('express');
const { subscribe, emit, emitToUser } = require('../streams/suggestionsSSE');
const { optionalAuth, requireAuth } = require('../middlewares/auth');
const { generateSuggestionsNL } = require('../services/openai');

const router = express.Router();

router.get('/suggestions', optionalAuth, (req, res) => {
  const conversationId = req.query.conversation_id || req.query.conversationId;
  console.debug('[suggestionsSSE] subscribe', { conversationId, user: req.user?.email });
  subscribe(conversationId, req, res);
});

// Body: { conversation_id, transcript, context? }
router.post('/suggest', requireAuth, async (req, res) => {
  const { conversation_id, transcript = '', context = {} } = req.body || {};
  try {
    const items = await generateSuggestionsNL(transcript, context, 5);

    const payload = {
      conversation_id: conversation_id || null,
      suggestions: items.map(s => s.text),
      raw: items,
    };

    // 1) Emit naar expliciete conversatie (als meegegeven)
    if (conversation_id) emit(conversation_id, payload);

    // 2) Altijd ook naar alle actieve conversaties van de ingelogde user
    if (req.user?.id) emitToUser(req.user.id, payload);

    console.debug('[suggestions] generated', {
      conversation_id: conversation_id || null,
      count: items.length,
      user: req.user?.email,
    });

    return res.json({ suggestions: items });
  } catch (err) {
    console.error('[suggestions] error', { error: err?.message });
    return res.status(500).json({ error: 'suggestions_failed' });
  }
});

module.exports = router;
