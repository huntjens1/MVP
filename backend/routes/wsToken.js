// backend/routes/wsToken.js
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'change-me';
const WS_TOKEN_TTL_SEC = Number(process.env.WS_TOKEN_TTL_SEC || 600);

function readAuthToken(req) {
  const hdr = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(hdr);
  if (m) return m[1];
  if (req.signedCookies && req.signedCookies.auth) return req.signedCookies.auth;
  if (req.cookies && req.cookies.auth) return req.cookies.auth;
  return null;
}

// POST /api/ws-token
router.post('/ws-token', (req, res) => {
  const token = readAuthToken(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  try {
    const me = jwt.verify(token, JWT_SECRET);
    const conversation_id = (req.body && req.body.conversation_id) || (req.query && req.query.conversation_id) || null;

    const wsToken = jwt.sign(
      { sub: me.sub || me.id || 'u_demo', conversation_id, scope: 'mic' },
      JWT_SECRET,
      { expiresIn: WS_TOKEN_TTL_SEC }
    );

    console.debug('[ws-token] issued', {
      user: me.email || me.sub,
      ttl: WS_TOKEN_TTL_SEC,
      conversation_id,
    });
    return res.json({ token: wsToken });
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
});

module.exports = router;
