// CommonJS router die automatisch je bestaande auth controller/middleware vindt.
// Belangrijk: zet/cleart 'clx_tenant' cookie op basis van e-maildomein.

const express = require('express');
const { getTenantByEmailDomain } = require('../services/tenants');
const router = express.Router();

function safeRequire(p) { try { return require(p); } catch { return null; } }

function collectFns(obj, prefix = '', out = [], depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 2) return out;
  for (const k of Object.keys(obj)) {
    const v = obj[k]; const name = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'function') out.push({ name, fn: v });
    else if (v && typeof v === 'object') collectFns(v, name, out, depth + 1);
  }
  return out;
}
function pickHandler(mod, names) {
  if (!mod) return null;
  if (typeof mod === 'function') return mod;
  let candidates = collectFns(mod);
  if (mod.default) candidates = candidates.concat(collectFns(mod.default, 'default'));
  for (const n of names) {
    const hit = candidates.find(c => c.name.split('.').pop() === n);
    if (hit) return hit.fn;
  }
  // fuzzy
  const re = new RegExp(names.map(n => n.replace(/\W+/g, '.?')).join('|'), 'i');
  const fuzzy = candidates.find(c => re.test(c.name));
  return fuzzy ? fuzzy.fn : null;
}

// Controllers/middleware (ongeacht exportnaam)
const ctrlMod = safeRequire('../controllers/authController');
const mwMod   = safeRequire('../middlewares/auth');

const loginHandler  = pickHandler(ctrlMod, ['login','signIn','authenticate','postLogin']);
const logoutHandler = pickHandler(ctrlMod, ['logout','signOut']);
const meHandler     = pickHandler(ctrlMod, ['me','getMe','profile','current']);
const requireAuth   = pickHandler(mwMod, ['requireAuth','auth','ensureAuth','isAuthenticated','protect']);

// Cookie helpers
const ONE_YEAR = 60 * 60 * 24 * 365;
function setTenantCookie(res, tenantId) {
  const cookie = [
    `clx_tenant=${encodeURIComponent(String(tenantId))}`,
    'Path=/',
    `Max-Age=${ONE_YEAR}`,
    'HttpOnly',
    'Secure',
    'SameSite=None',
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);
}
function clearTenantCookie(res) {
  const cookie = [
    'clx_tenant=',
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=None',
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);
}

// ===== /api/login =====
// Bepaal tenant uit e-maildomein en zet cookie. Daarna door naar jouw login handler.
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').toLowerCase();
    const t = await getTenantByEmailDomain(email);
    if (t?.id) {
      setTenantCookie(res, t.id);
      // propagate naar downstream zodat policies meteen juist zijn
      req.tenant = t.id;
      res.locals.tenant_id = t.id;
      req.headers['x-tenant-id'] = t.id;
    }
  } catch { /* ignore tenant miss; login kan alsnog 400 geven verderop */ }

  if (typeof loginHandler === 'function') return loginHandler(req, res, next);
  return res.status(400).json({ error: 'login_handler_missing' });
});

// ===== /api/logout =====
if (typeof logoutHandler === 'function') {
  router.post('/logout', (req, res, next) => {
    clearTenantCookie(res);
    logoutHandler(req, res, next);
  });
} else {
  router.post('/logout', (req, res) => { clearTenantCookie(res); res.status(204).end(); });
}

// ===== /api/me =====
if (requireAuth && meHandler) {
  router.get('/me', requireAuth, (req, res, next) => meHandler(req, res, next));
} else if (requireAuth) {
  router.get('/me', requireAuth, (req, res) => res.json({ user: req.user ?? null }));
} else if (meHandler) {
  router.get('/me', (req, res, next) => meHandler(req, res, next));
} else {
  router.get('/me', (_req, res) => res.json({ user: null }));
}

module.exports = router;
