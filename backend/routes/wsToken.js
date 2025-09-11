// backend/routes/wsToken.js
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const DEBUG_ON = /^true|1|yes$/i.test(String(process.env.DEBUG || 'false'));
const debug = (...a) => { if (DEBUG_ON) console.log('[ws-token]', ...a); };

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'change-me';

// optioneel: korte TTL voor WS tokens
const WS_TOKEN_TTL_SEC = Number(process.env.WS_TOKEN_TTL_SEC || 600);

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

router.post('/ws-token', (req, res) => {
  const user = verifyAuth(req);
  if (!user) {
    debug('unauthorized');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const claims = {
    sub: user.sub || user.id || 'user',
    typ: 'ws',
  };

  const token = jwt.sign(claims, JWT_SECRET, { expiresIn: WS_TOKEN_TTL_SEC });
  debug('issued', { sub: claims.sub, expSec: WS_TOKEN_TTL_SEC });

  // 🔴 Belangrijk: frontend verwacht "token"
  return res.status(200).json({ token });
});

module.exports = router;
