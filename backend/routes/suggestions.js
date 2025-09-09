// backend/routes/suggestions.js
const express = require('express');
const router = express.Router();

// Let op: dit is jullie bestaande stream handler
// Pad laten matchen met jullie repo-structuur:
const suggestionsSSE = require('../streams/suggestionsSSE');

/**
 * Server-Sent Events voor AI-vraagsuggesties
 * Query: ?conversation_id=UUID
 */
router.get('/suggestions', async (req, res, next) => {
  try {
    // De handler schrijft zelf SSE headers en events naar res
    await suggestionsSSE(req, res);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
