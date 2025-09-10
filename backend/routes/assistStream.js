const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { startAssistSSE } = require('../streams/assistSSE');

const router = express.Router();

/**
 * GET /api/assist-stream?conversation_id=...
 * Server-Sent Events voor live AI suggesties.
 */
router.get('/assist-stream', requireAuth, (req, res) => {
  const { conversation_id } = req.query;
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id is required' });

  startAssistSSE(res, { conversation_id });
});

module.exports = router;
