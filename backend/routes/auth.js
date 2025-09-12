// backend/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// ---- config
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-prod';
const COOKIE_NAME = 'auth';

// Helper: read JWT from cookie or Authorization: Bearer
function readAuth(req) {
  const bearer = req.get('authorization');
  const token =
    (req.cookies && req.cookies[COOKIE_NAME]) ||
    (bearer && bearer.startsWith('Bearer ') ? bearer.slice(7) : null);

  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.error('[auth] verify failed:', err.message);
    return null;
  }
}

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    console.log('[auth] login attempt', { email, hasPassword: !!password });

    // Minimal credential check:
    // allow either static pair from env or "any password" if APP_ALLOW_ANY=1 for quick demos
    const ALLOW_ANY = process.env.APP_ALLOW_ANY === '1';
    const VALID_EMAIL = process.env.APP_USER_EMAIL;
    const VALID_PASS = process.env.APP_USER_PASSWORD;

    if (!ALLOW_ANY) {
      if (!VALID_EMAIL || !VALID_PASS) {
        console.warn('[auth] missing APP_USER_EMAIL / APP_USER_PASSWORD env');
      }
      const ok = email === VALID_EMAIL && password === VALID_PASS;
      if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    }

    const token = jwt.sign({ sub: email, type: 'auth' }, JWT_SECRET, {
      expiresIn: '7d',
    });

    // Cookie for browser use; header for programmatic use
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 3600 * 1000,
    });

    console.log('[auth] login ok', { email });
    return res.json({ user: { email }, token });
  } catch (err) {
    console.error('[auth] login error', err);
    return res.status(500).json({ error: 'login_failed' });
  }
});

// GET /api/me
router.get('/me', (req, res) => {
  const payload = readAuth(req);
  if (!payload) {
    console.log('[auth] /me unauthenticated');
    return res.status(401).json({ error: 'unauthenticated' });
  }
  console.log('[auth] /me', { sub: payload.sub });
  return res.json({ user: { email: payload.sub } });
});

// POST /api/logout (optional, used if you add a logout button)
router.post('/logout', (req, res) => {
  console.log('[auth] logout');
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.status(204).end();
});

module.exports = router;
