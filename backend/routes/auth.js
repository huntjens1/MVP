// Robust CommonJS auth-router die je bestaande controller/middleware gebruikt,
// ongeacht export-namen (login/signIn/postLogin, me/getMe/profile, etc.)

const express = require('express');
const router = express.Router();

function safeRequire(p) {
  try { return require(p); } catch { return null; }
}

function firstFn(mod, names = []) {
  if (!mod) return null;
  // 1) directe exports als functie
  if (typeof mod === 'function') return mod;
  // 2) default export kan functie of object zijn
  if (mod.default) {
    if (typeof mod.default === 'function') return mod.default;
    for (const n of names) {
      if (typeof mod.default[n] === 'function') return mod.default[n];
    }
  }
  // 3) named exports
  for (const n of names) {
    if (typeof mod[n] === 'function') return mod[n];
  }
  return null;
}

// Pak controller & middleware (met meerdere mogelijke naampjes)
const ctrlMod = safeRequire('../controllers/authController');
const mwMod   = safeRequire('../middlewares/auth');

const loginHandler = firstFn(ctrlMod, ['login', 'signIn', 'signin', 'postLogin', 'authenticate']);
const logoutHandler = firstFn(ctrlMod, ['logout', 'signOut', 'signout']);
const meHandler = firstFn(ctrlMod, ['me', 'getMe', 'profile', 'current']);

const requireAuth = firstFn(mwMod, ['requireAuth', 'auth', 'ensureAuth', 'isAuthenticated', 'protect']);

// ===== /api/login =====
if (loginHandler) {
  router.post('/login', (req, res, next) => loginHandler(req, res, next));
} else {
  // fail-soft zonder 5xx
  router.post('/login', (_req, res) => res.status(400).json({ error: 'login_handler_missing' }));
}

// ===== /api/logout (optioneel) =====
if (logoutHandler) {
  router.post('/logout', (req, res, next) => logoutHandler(req, res, next));
}

// ===== /api/me =====
if (requireAuth && meHandler) {
  router.get('/me', requireAuth, (req, res, next) => meHandler(req, res, next));
} else if (requireAuth) {
  // Als alleen middleware bestaat, geef de user terug die middleware heeft gezet
  router.get('/me', requireAuth, (req, res) => res.json({ user: req.user ?? null }));
} else if (meHandler) {
  router.get('/me', (req, res, next) => meHandler(req, res, next));
} else {
  // fail-soft i.p.v. 5xx: app is nog niet geconfigureerd
  router.get('/me', (_req, res) => res.json({ user: null }));
}

module.exports = router;
