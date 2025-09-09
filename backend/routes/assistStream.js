// backend/routes/assistStream.js
const express = require('express');
const router = express.Router();

// Hergebruik dezelfde SSE-implementatie voorlopig.
// Als je later een specifiek assist-kanaal wilt, vervang je dit require.
const suggestionsSSE = require('../streams/suggestionsSSE');

/**
 * Server-Sent Events voor "live assist"
 * Query: ?conversation_id=UUID
 */
router.get('/assist-stream', async (req, res, next) => {
  try {
    await suggestionsSSE(req, res);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
