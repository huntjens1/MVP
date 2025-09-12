// backend/routes/assistStream.js
const express = require('express');
const { subscribe } = require('../streams/assistSSE');
const { optionalAuth } = require('../middlewares/auth');

const router = express.Router();

// GET /api/assist-stream?conversation_id=...
router.get('/assist-stream', optionalAuth, (req, res) => {
  const conversationId = req.query.conversation_id || req.query.conversationId;
  console.debug('[assistSSE] subscribe', { conversationId, user: req.user?.email });
  subscribe(conversationId, req, res);
});

module.exports = router;
