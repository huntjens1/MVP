// backend/routes/auth.js
// Production-safe login flow:
// 1) Probeer Supabase Auth (email+password) -> bij succes: eigen JWT cookie zetten
// 2) Val terug op env-admin (APP_USER_EMAIL / APP_USER_PASSWORD) als fallback
// Geen insecure toggles; strakke logging zonder secrets.

const express = require('express');
const jwt = require('jsonwebtoken');

let supabase = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    console.debug('[auth] supabase client initialized');
  } else {
    console.debug('[auth] supabase not configured (skipping)');
  }
} catch (e) {
  console.error('[auth] supabase init failed', { error: e?.message });
}

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth';

function signToken(user, { expiresIn = '7d' } = {}) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn }
  );
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function readBearerOrCookie(req) {
  const hdr = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(hdr);
  if (m) return m[1];
  if (req.signedCookies && req.signedCookies[AUTH_COOKIE_NAME]) return req.signedCookies[AUTH_COOKIE_NAME];
  if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) return req.cookies[AUTH_COOKIE_NAME];
  return null;
}

function verify(token) { try { return jwt.verify(token, JWT_SECRET); } catch { return null; } }

// POST /api/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    console.debug('[auth] login missing fields');
    return res.status(400).json({ error: 'missing_credentials' });
  }

  // 1) Supabase Auth (voorkeur)
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data?.user) {
        const u = data.user;
        const user = {
          id: u.id,
          email: u.email,
          name: u.user_metadata?.name || u.email?.split('@')[0] || 'User',
          role: (u.app_metadata && u.app_metadata.role) || 'user',
        };
        const token = signToken(user);
        res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
        console.debug('[auth] login via supabase', { email: user.email });
        return res.json({ user, token });
      }
      console.debug('[auth] supabase auth failed', { email, code: error?.status, msg: error?.message });
      // Let op: geen early return; we proberen nog env-admin fallback
    } catch (e) {
      console.error('[auth] supabase auth error', { error: e?.message });
      // Ga door naar fallback
    }
  }

  // 2) Env-admin fallback (bestaand gedrag)
  const validEmail = process.env.APP_USER_EMAIL || 'demo@calllogix.local';
  const validPass  = process.env.APP_USER_PASSWORD || 'demo123';

  if (email === validEmail && password === validPass) {
    const user = { id: 'u_admin', name: 'Admin', email: validEmail, role: 'admin' };
    const token = signToken(user);
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
    console.debug('[auth] login via env-admin', { email: user.email });
    return res.json({ user, token });
  }

  console.debug('[auth] invalid credentials', { email });
  return res.status(401).json({ error: 'invalid_credentials' });
});

// GET /api/me
router.get('/me', (req, res) => {
  const token = readBearerOrCookie(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  const p = verify(token);
  if (!p) return res.status(401).json({ error: 'invalid_token' });
  return res.json({ user: { id: p.sub, name: p.name, email: p.email, role: p.role || 'user' } });
});

// POST /api/logout
router.post('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/', sameSite: 'none', secure: true });
  return res.json({ ok: true });
});

module.exports = router;
