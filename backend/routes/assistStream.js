'use strict';

const express = require('express');
const router = express.Router();
const { sseSubscribe } = require('../streams/assistSSE');

// NB: Als je auth wilt afdwingen kun je hier je eigen middleware plaatsen
// const { requireAuth } = require('../middlewares/auth');  // voorbeeld

router.get('/assist-stream', /* requireAuth, */ (req, res) => {
  const conversationId = req.query.conversation_id;
  console.log('[assist-stream] SSE subscribe attempt', {
    conversationId,
    origin: req.headers.origin,
  });

  try {
    sseSubscribe(conversationId, res, req);
  } catch (err) {
    console.error('[assist-stream] SSE subscribe error:', err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'sse_subscribe_failed' });
    } else {
      try { res.end(); } catch {}
    }
  }
});

module.exports = router;
