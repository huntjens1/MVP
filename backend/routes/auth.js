// Robust CommonJS auth-router: vindt jouw handlers ongeacht export-namen.
// Lost 400/501 "not implemented" op door automatisch te binden.

const express = require('express');
const router = express.Router();

function safeRequire(p) {
  try { return require(p); } catch { return null; }
}

function collectFns(obj, prefix = '', out = [], depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 2) return out;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const name = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'function') out.push({ name, fn: v });
    else if (v && typeof v === 'object') collectFns(v, name, out, depth + 1);
  }
  return out;
}

function pickHandler(mod, kind) {
  if (!mod) return null;
  // direct function export
  if (typeof mod === 'function') return { picked: '<module fn>', fn: mod };

  // build list of candidate functions (named + default + nested up to depth 2)
  let candidates = [];
  candidates = candidates.concat(collectFns(mod));
  if (mod.default) candidates = candidates.concat(collectFns(mod.default, 'default'));

  const patterns = {
    login: [/^login$/i, /^sign.?in$/i, /^authenticate$/i, /post.?login/i],
    me: [/^me$/i, /^get.?me$/i, /^profile$/i, /^current$/i, /^user$/i],
    logout: [/^logout$/i, /^sign.?out$/i]
  }[kind] || [];

  // 1) exact name list
  for (const { name, fn } of candidates) {
    if (patterns.some(r => r.test(name.split('.').pop() || ''))) {
      return { picked: name, fn };
    }
  }
  // 2) last-resort heuristic: any function whose name contains the keyword
  const kw = kind === 'login' ? /log.?in|sign.?in|auth/i :
             kind === 'logout' ? /log.?out|sign.?out/i :
             /get.?me|me|profile|current|user/i;
  for (const { name, fn } of candidates) {
    if (kw.test(name)) return { picked: name, fn };
  }
  return null;
}

// Load controller + middleware
const ctrlMod = safeRequire('../controllers/authController');
const mwMod   = safeRequire('../middlewares/auth');

// Pick handlers
const loginPick  = pickHandler(ctrlMod, 'login');
const logoutPick = pickHandler(ctrlMod, 'logout');
const mePick     = pickHandler(ctrlMod, 'me');

const requireAuthPick = pickHandler(mwMod, 'login')      // vaak 'auth' of 'requireAuth'
  || pickHandler(mwMod, 'me');                           // fallback

// Debug logging (1 regel per pick)
console.log('[auth-router] login =', loginPick ? loginPick.picked : 'not-found');
console.log('[auth-router] logout =', logoutPick ? logoutPick.picked : 'not-found');
console.log('[auth-router] requireAuth =', requireAuthPick ? requireAuthPick.picked : 'not-found');
console.log('[auth-router] me =', mePick ? mePick.picked : 'not-found');

// Routes
if (loginPick) {
  router.post('/login', (req, res, next) => loginPick.fn(req, res, next));
} else {
  router.post('/login', (_req, res) =>
    res.status(400).json({ error: 'login_handler_missing', hint: 'export a function named login/signIn/authenticate' })
  );
}

if (logoutPick) {
  router.post('/logout', (req, res, next) => logoutPick.fn(req, res, next));
}

if (requireAuthPick && mePick) {
  router.get('/me', (req, res, next) => requireAuthPick.fn(req, res, (e) => e ? next(e) : mePick.fn(req, res, next)));
} else if (requireAuthPick) {
  router.get('/me', (req, res, next) => requireAuthPick.fn(req, res, (e) => e ? next(e) : res.json({ user: req.user ?? null })));
} else if (mePick) {
  router.get('/me', (req, res, next) => mePick.fn(req, res, next));
} else {
  router.get('/me', (_req, res) => res.json({ user: null }));
}

module.exports = router;
