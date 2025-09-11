// backend/routes/assistStream.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { subscribe: sseSubscribe, emit: sseEmit } = require('../streams/assistSSE');

const router = express.Router();

const DEBUG_ON = /^true|1|yes$/i.test(String(process.env.DEBUG || 'false'));
const debug = (...a) => { if (DEBUG_ON) console.log('[assist-stream]', ...a); };

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'change-me';

// Zelfde auth als suggestions
function verifyAuth(req) {
  try {
    const cookieToken = req.cookies?.auth;
    const hdr = req.headers['authorization'];
    const hdrToken = hdr && hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    const token = cookieToken || hdrToken;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    debug('auth verify failed:', e?.message);
    return null;
  }
}

// GET /api/assist-stream?conversation_id=...
router.get('/assist-stream', (req, res) => {
  const conversationId = String(req.query.conversation_id || '').trim();
  debug('SSE subscribe attempt', { conversationId, origin: req.headers.origin });

  if (!conversationId) {
    return res.status(400).json({ error: 'conversation_id is required' });
  }

  const user = verifyAuth(req);
  if (!user) {
    debug('unauthorized SSE');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    sseSubscribe(conversationId, res);
    res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, conversation_id: conversationId })}\n\n`);
    debug('SSE subscribed', { conversationId, user: user?.sub || user?.id });
  } catch (e) {
    debug('SSE subscribe error:', e?.message);
    return res.status(500).json({ error: 'SSE init failed' });
  }
});

// Optioneel: event trigger (je huidige /api/assist laat ik ongemoeid; dit is alleen extra/debug)
router.post('/assist', express.json(), (req, res) => {
  const user = verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { conversation_id, payload } = req.body || {};
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id is required' });

  const msg = { conversation_id, payload: payload || {}, ts: Date.now() };
  sseEmit(conversation_id, msg);
  debug('assist emit', { conversation_id });

  return res.status(200).json({ ok: true });
});

module.exports = router;
