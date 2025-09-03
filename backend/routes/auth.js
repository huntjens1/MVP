// Auth-router met automatische tenant-koppeling + fallback JWT-auth.
// Volgorde:
// 1) tenant via tenant_users(email) -> {tenant, role}
// 2) anders via tenants.domain = email-domein
// 3) als niets: 400 (of dev-bypass via ALLOW_LOGIN_WITHOUT_TENANT=1)

const express = require('express');
const crypto = require('crypto');
const { getTenantForUserEmail, getTenantByEmailDomain } = require('../services/tenants');
const router = express.Router();

/* ------- helpers: dynamic controller discovery (als je eigen controller bestaat) ------- */
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

let loginHandler  = pickHandler(ctrlMod, ['login','signIn','authenticate','postLogin']);
let logoutHandler = pickHandler(ctrlMod, ['logout','signOut']);
let meHandler     = pickHandler(ctrlMod, ['me','getMe','profile','current']);
let requireAuth   = pickHandler(mwMod,   ['requireAuth','auth','ensureAuth','isAuthenticated','protect']);

/* -------------------- Fallback JWT-auth (alleen als geen eigen handlers bestaan) -------------------- */
const ONE_DAY  = 60 * 60 * 24;
const ONE_YEAR = ONE_DAY * 365;

function b64u(input) {
  return Buffer.from(input).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function signJWT(payload, expSec = ONE_DAY) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now()/1000);
  const body = { ...payload, iat: now, exp: now + expSec };
  const secret = process.env.CALLLOGIX_JWT_SECRET || 'dev-secret-change-me';
  const h = b64u(JSON.stringify(header));
  const p = b64u(JSON.stringify(body));
  const data = `${h}.${p}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return `${data}.${sig}`;
}
function verifyJWT(token) {
  try {
    const [h, p, s] = String(token || '').split('.');
    if (!h || !p || !s) return null;
    const secret = process.env.CALLLOGIX_JWT_SECRET || 'dev-secret-change-me';
    const expect = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    if (expect !== s) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch { return null; }
}
function setCookie(res, name, value, maxAgeSec) {
  const cookie = [
    `${name}=${encodeURIComponent(String(value))}`,
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    'HttpOnly',
    'Secure',
    'SameSite=None',
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);
}
function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`);
}

// Fallback requireAuth
if (!requireAuth) {
  requireAuth = (req, res, next) => {
    const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('clx_session='))?.split('=')[1];
    const payload = token ? verifyJWT(decodeURIComponent(token)) : null;
    if (!payload) return res.status(401).json({ error: 'unauthorized' });
    req.user = payload.user;
    req.tenant = payload.tenant_id;
    res.locals.tenant_id = payload.tenant_id;
    return next();
  };
}

// Fallback me handler
if (!meHandler) {
  meHandler = (req, res) => {
    const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('clx_session='))?.split('=')[1];
    const payload = token ? verifyJWT(decodeURIComponent(token)) : null;
    return res.json({ user: payload?.user || null });
  };
}

// Fallback login handler
if (!loginHandler) {
  loginHandler = async (req, res) => {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const password = String(req.body?.password || '');
    const allowNoTenant = process.env.ALLOW_LOGIN_WITHOUT_TENANT === '1';

    // simpele password check voor MVP (pas aan naar echte auth of zet ALLOW_LOGIN_WITHOUT_TENANT=1)
    if (!password && !allowNoTenant) {
      return res.status(400).json({ error: 'missing_password' });
    }

    // 1) mapping via tenant_users
    let map = await getTenantForUserEmail(email);
    let tenant = map?.tenant || null;
    let role = map?.role || 'agent';

    // 2) fallback via domein
    if (!tenant) {
      tenant = await getTenantByEmailDomain(email);
      role = 'agent';
    }

    if (!tenant && !allowNoTenant) {
      const domain = (email.split('@')[1] || '').trim();
      return res.status(400).json({
        error: 'tenant_for_user_not_found',
        message: 'Geen tenant gevonden voor deze gebruiker.',
        detail: { email, domain },
      });
    }

    if (tenant?.id) {
      // zet tenant cookie zodat middleware en CORS tenant-bewust zijn
      setCookie(res, 'clx_tenant', tenant.id, ONE_YEAR);
    }

    // Maak (MVP) user payload. In productie vervang je dit door echte user-id/auth.
    const user = {
      id: crypto.createHash('sha1').update(email).digest('hex'),
      email,
      name: email.split('@')[0],
      role,
      tenant_id: tenant?.id || null,
    };
    const token = signJWT({ user, tenant_id: user.tenant_id }, ONE_DAY);
    setCookie(res, 'clx_session', token, ONE_DAY);

    return res.json({ user });
  };
}

// Fallback logout handler
if (!logoutHandler) {
  logoutHandler = (req, res) => {
    clearCookie(res, 'clx_session');
    clearCookie(res, 'clx_tenant');
    return res.status(204).end();
  };
}

/* ------------------------------- ROUTES ------------------------------- */
router.post('/login', (req, res, next) => loginHandler(req, res, next));
router.post('/logout', (req, res, next) => logoutHandler(req, res, next));
router.get('/me', (req, res, next) => meHandler(req, res, next));

module.exports = router;
