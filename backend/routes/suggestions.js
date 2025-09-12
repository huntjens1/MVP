// backend/routes/suggestions.js
const express = require('express');
const { subscribe } = require('../streams/suggestionsSSE');
const { optionalAuth } = require('../middlewares/auth');

const router = express.Router();

// GET /api/suggestions?conversation_id=...
router.get('/suggestions', optionalAuth, (req, res) => {
  const conversationId = req.query.conversation_id || req.query.conversationId;
  console.debug('[suggestionsSSE] subscribe', { conversationId, user: req.user?.email });
  subscribe(conversationId, req, res);
});

module.exports = router;
