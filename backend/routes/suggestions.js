const express = require('express');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

/**
 * GET /api/suggestions?conversation_id=...
 * Retourneert huidige batch suggesties (JSON).
 * (Als je SSE wilt, gebruik /api/assist-stream.)
 */
router.get('/suggestions', requireAuth, async (req, res) => {
  const { conversation_id } = req.query;
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id is required' });

  // TODO: vervang door echte suggestie service
  res.json({ conversation_id, suggestions: [] });
});

module.exports = router;
