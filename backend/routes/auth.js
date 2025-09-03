const express = require('express');
const crypto = require('crypto');
const { getTenantForUserEmail, getTenantByEmailDomain, getDefaultTenantFromEnv } = require('../services/tenants');
const router = express.Router();

/* ===== dynamic controller discovery (optioneel) ===== */
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
  for (const n of names) { const hit = c.find(x => x.name.split('.').pop() === n); if (hit) return hit.fn; }
  const re = new RegExp(names.map(n => n.replace(/\W+/g, '.?')).join('|'), 'i');
  const fuzzy = c.find(x => re.test(x.name)); return fuzzy ? fuzzy.fn : null;
}

const ctrlMod = safeRequire('../controllers/authController');
const mwMod   = safeRequire('../middlewares/auth');

let loginHandler  = pickHandler(ctrlMod, ['login','signIn','authenticate','postLogin']);
let logoutHandler = pickHandler(ctrlMod, ['logout','signOut']);
let meHandler     = pickHandler(ctrlMod, ['me','getMe','profile','current']);
let requireAuth   = pickHandler(mwMod,   ['requireAuth','auth','ensureAuth','isAuthenticated','protect']);

/* ===== Fallback JWT-auth indien geen eigen handlers ===== */
const ONE_DAY  = 60 * 60 * 24;
const ONE_YEAR = ONE_DAY * 365;
const SECRET   = process.env.CALLLOGIX_JWT_SECRET || 'dev-secret-change-me';

function b64u(s){return Buffer.from(s).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function signJWT(payload, expSec = ONE_DAY) {
  const header = { alg:'HS256', typ:'JWT' };
  const now = Math.floor(Date.now()/1000);
  const body = { ...payload, iat:now, exp:now+expSec };
  const h = b64u(JSON.stringify(header)); const p = b64u(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return `${h}.${p}.${sig}`;
}
function verifyJWT(token){
  try{
    const [h,p,s]=String(token||'').split('.');
    const expSig = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    if(expSig!==s) return null;
    const payload = JSON.parse(Buffer.from(p,'base64').toString('utf8'));
    if(!payload.exp || payload.exp<Math.floor(Date.now()/1000)) return null;
    return payload;
  }catch{return null;}
}
function setCookie(res, name, value, maxAgeSec) {
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(String(value))}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=None`);
}
function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`);
}
function extractToken(req){
  const h = String(req.headers.authorization || '');
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1];
  const raw = (req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('clx_session='))?.split('=')[1];
  return raw ? decodeURIComponent(raw) : null;
}

if (!requireAuth) {
  requireAuth = (req, res, next) => {
    const token = extractToken(req);
    const payload = token ? verifyJWT(token) : null;
    if (!payload) return res.status(401).json({ error: 'unauthorized' });
    req.user = payload.user; req.tenant = payload.tenant_id; res.locals.tenant_id = payload.tenant_id;
    return next();
  };
}
if (!meHandler) {
  meHandler = (req, res) => {
    const token = extractToken(req);
    const payload = token ? verifyJWT(token) : null;
    return res.json({ user: payload?.user || null });
  };
}
if (!loginHandler) {
  loginHandler = async (req, res) => {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const password = String(req.body?.password || '');
    const allowDefault = process.env.ALLOW_DEFAULT_TENANT === '1';

    if (!email) return res.status(400).json({ error: 'missing_email' });
    if (!password && !allowDefault) return res.status(400).json({ error: 'missing_password' });

    // 1) expliciete mapping
    let map = await getTenantForUserEmail(email);
    let tenant = map?.tenant || null;
    let role = map?.role || 'agent';

    // 2) domeinfallback
    if (!tenant) { tenant = await getTenantByEmailDomain(email); role = 'agent'; }

    // 3) default tenant (env) voor testmailtjes
    if (!tenant && allowDefault) { tenant = await getDefaultTenantFromEnv(); role = 'tester'; }

    if (!tenant) {
      const domain = (email.split('@')[1] || '').trim();
      return res.status(400).json({
        error: 'tenant_for_user_not_found',
        message: 'Geen tenant gevonden voor deze gebruiker.',
        detail: { email, domain }
      });
    }

    setCookie(res, 'clx_tenant', tenant.id, ONE_YEAR);

    const user = {
      id: crypto.createHash('sha1').update(email).digest('hex'),
      email,
      name: email.split('@')[0],
      role,
      tenant_id: tenant.id,
    };
    const token = signJWT({ user, tenant_id: tenant.id }, ONE_DAY);
    setCookie(res, 'clx_session', token, ONE_DAY);

    // ⚠️ BELANGRIJK: naast cookies geven we ook het token terug → front kan Authorization header zetten
    return res.json({ user, token });
  };
}
if (!logoutHandler) {
  logoutHandler = (req, res) => { clearCookie(res, 'clx_session'); clearCookie(res, 'clx_tenant'); return res.status(204).end(); };
}

/* routes */
router.post('/login', (req, res, next) => loginHandler(req, res, next));
router.post('/logout', (req, res, next) => logoutHandler(req, res, next));
router.get('/me', (req, res, next) => meHandler(req, res, next));

module.exports = router;
