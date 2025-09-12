// backend/routes/suggestions.js
// - GET  /api/suggestions?conversation_id=...   ← SSE subscribe (bestond al)
// - POST /api/suggest                            ← Genereert suggestions en (optioneel) broadcast naar SSE
//
// Let op: geen features verwijderd; alleen POST toegevoegd om 404 te fixen.

const express = require('express');
const { subscribe, emit } = require('../streams/suggestionsSSE');
const { optionalAuth, requireAuth } = require('../middlewares/auth');
const { generateSuggestionsNL } = require('../services/openai');

const router = express.Router();

// GET /api/suggestions?conversation_id=...
router.get('/suggestions', optionalAuth, (req, res) => {
  const conversationId = req.query.conversation_id || req.query.conversationId;
  console.debug('[suggestionsSSE] subscribe', { conversationId, user: req.user?.email });
  subscribe(conversationId, req, res);
});

// POST /api/suggest
// Body: { conversation_id, transcript, context? }
router.post('/suggest', requireAuth, async (req, res) => {
  const { conversation_id, transcript = '', context = {} } = req.body || {};
  try {
    const items = await generateSuggestionsNL(transcript, context, 5);

    // SSE broadcast (optioneel, alleen als we een conversatie-id hebben)
    if (conversation_id) {
      emit(conversation_id, {
        conversation_id,
        suggestions: items.map(s => s.text), // voor UI
        raw: items, // behoud extra velden (itil/priority) voor wie ze leest
      });
    }

    console.debug('[suggestions] generated', {
      conversation_id: conversation_id || null,
      count: items.length,
    });

    return res.json({ suggestions: items });
  } catch (err) {
    console.error('[suggestions] error', { error: err?.message });
    return res.status(500).json({ error: 'suggestions_failed' });
  }
});

module.exports = router;
