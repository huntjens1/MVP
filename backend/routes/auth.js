// CommonJS versie (geen ESM imports), compatible met jouw huidige backend
const express = require('express');
const router = express.Router();

// Safe require helpers – voorkomen crash als files nog in transitie zijn
function safeRequire(path) {
  try { return require(path); } catch (_e) { return {}; }
}

const ctrl = safeRequire('../controllers/authController');   // verwacht bv. ctrl.login, ctrl.logout, ctrl.me
const requireAuth = safeRequire('../middlewares/auth');      // middleware die req.user zet (of 401)

// --- /api/login ---
if (typeof ctrl.login === 'function') {
  // Gebruik jouw bestaande login-controller
  router.post('/login', ctrl.login);
} else {
  // Fallback om 502/404 te voorkomen (geen echte login)
  router.post('/login', (_req, res) => {
    res.status(501).json({ error: 'login_not_implemented' });
  });
}

// --- /api/logout (optioneel) ---
if (typeof ctrl.logout === 'function') {
  router.post('/logout', ctrl.logout);
}

// --- /api/me ---
if (typeof requireAuth === 'function') {
  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user ?? null });
  });
} else if (typeof ctrl.me === 'function') {
  // Sommige projecten hebben rechtstreeks ctrl.me
  router.get('/me', ctrl.me);
} else {
  // Fallback zonder auth-middleware
  router.get('/me', (_req, res) => {
    res.status(200).json({ user: null });
  });
}

module.exports = router;
