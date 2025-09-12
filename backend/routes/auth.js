// backend/routes/auth.js
const express = require('express');
const { signToken } = require('../middlewares/auth');

const router = express.Router();

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

// POST /api/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const allowAny = /^1|true|yes$/i.test(String(process.env.APP_ALLOW_ANY || '0'));

  const validEmail = process.env.APP_USER_EMAIL || 'demo@calllogix.local';
  const validPass = process.env.APP_USER_PASSWORD || 'demo123';

  if (!allowAny) {
    if (!email || !password) return res.status(400).json({ error: 'missing_credentials' });
    if (email !== validEmail || password !== validPass) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
  }

  const user = { id: 'u_demo', name: 'Demo User', email: email || validEmail };
  const token = signToken(user);

  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
  console.debug('[auth] login', { email: user.email });
  return res.json({ user, token });
});

// GET /api/me
router.get('/me', (req, res) => {
  const hdr = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(hdr);
  const bearer = m ? m[1] : null;
  const cookie = (req.signedCookies && req.signedCookies[AUTH_COOKIE_NAME]) || (req.cookies && req.cookies[AUTH_COOKIE_NAME]) || null;

  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  const token = bearer || cookie;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const p = jwt.verify(token, secret);
    return res.json({ user: { id: p.sub, name: p.name, email: p.email } });
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
});

// POST /api/logout
router.post('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/', sameSite: 'none', secure: true });
  return res.json({ ok: true });
});

module.exports = router;
