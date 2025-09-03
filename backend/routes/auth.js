const express = require('express');
const { getTenantByUserEmail, getTenantByEmailDomain } = require('../services/tenants');
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
  let c = collectFns(mod);
  if (mod.default) c = c.concat(collectFns(mod.default, 'default'));
  for (const n of names) {
    const hit = c.find(x => x.name.split('.').pop() === n);
    if (hit) return hit.fn;
  }
  const re = new RegExp(names.map(n => n.replace(/\W+/g, '.?')).join('|'), 'i');
  const fuzzy = c.find(x => re.test(x.name));
  return fuzzy ? fuzzy.fn : null;
}

const ctrlMod = safeRequire('../controllers/authController');
const mwMod   = safeRequire('../middlewares/auth');

const loginHandler  = pickHandler(ctrlMod, ['login','signIn','authenticate','postLogin']);
const logoutHandler = pickHandler(ctrlMod, ['logout','signOut']);
const meHandler     = pickHandler(ctrlMod, ['me','getMe','profile','current']);
const requireAuth   = pickHandler(mwMod, ['requireAuth','auth','ensureAuth','isAuthenticated','protect']);

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
  const cookie = ['clx_tenant=','Path=/','Max-Age=0','HttpOnly','Secure','SameSite=None'].join('; ');
  res.setHeader('Set-Cookie', cookie);
}

// ---------- LOGIN ----------
router.post('/login', async (req, res, next) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const allowNoTenant = process.env.ALLOW_LOGIN_WITHOUT_TENANT === '1';

  try {
    // 1) expliciete mapping (tenant_users)
    let t = await getTenantByUserEmail(email);

    // 2) anders: fallback op e-maildomein (tenants.domain)
    if (!t) t = await getTenantByEmailDomain(email);

    if (!t?.id && !allowNoTenant) {
      const domain = (email.split('@')[1] || '').trim();
      return res.status(400).json({
        error: 'tenant_for_user_not_found',
        message: 'Geen tenant gevonden voor deze gebruiker.',
        detail: { email, domain },
        hint: 'Voeg user toe aan public.tenant_users of vul tenants.domain correct in. Voor dev: ALLOW_LOGIN_WITHOUT_TENANT=1',
      });
    }

    if (t?.id) {
      setTenantCookie(res, t.id);
      req.tenant = t.id;
      res.locals.tenant_id = t.id;
      req.headers['x-tenant-id'] = t.id;
    }
  } catch (e) {
    return res.status(400).json({ error: 'tenant_lookup_failed', detail: e?.message || String(e) });
  }

  if (typeof loginHandler === 'function') return loginHandler(req, res, next);
  return res.status(400).json({ error: 'login_handler_missing' });
});

// ---------- LOGOUT ----------
if (typeof logoutHandler === 'function') {
  router.post('/logout', (req, res, next) => { clearTenantCookie(res); logoutHandler(req, res, next); });
} else {
  router.post('/logout', (req, res) => { clearTenantCookie(res); res.status(204).end(); });
}

// ---------- ME ----------
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
