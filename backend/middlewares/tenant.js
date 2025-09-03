const { resolveTenant } = require('../services/tenants');

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  String(cookieHeader).split(';').forEach(p => {
    const [k, ...rest] = p.split('=');
    const key = k?.trim();
    if (!key) return;
    out[key] = decodeURIComponent(rest.join('=').trim());
  });
  return out;
}

/**
 * Bepaal welke requests géén tenant nodig hebben:
 * - Preflight / HEAD
 * - Health
 * - Auth endpoints: login, me, logout (inclusief /api/auth/* alias)
 */
const SKIP_METHODS = new Set(['OPTIONS', 'HEAD']);
const SKIP_REGEX = [
  /^\/health\/?$/i,
  /^\/api\/login\/?$/i,
  /^\/api\/me\/?$/i,
  /^\/api\/logout\/?$/i,
  /^\/api\/auth\/login\/?$/i,
  /^\/api\/auth\/me\/?$/i,
  /^\/api\/auth\/logout\/?$/i,
];

function shouldSkip(req) {
  if (SKIP_METHODS.has(req.method)) return true;
  const p = req.path || req.originalUrl || '';
  return SKIP_REGEX.some(re => re.test(p));
}

async function tenantResolver(req, res, next) {
  // ⛔ Skip voor preflight/HEAD en auth/health paden
  if (shouldSkip(req)) return next();

  const origin = req.headers.origin || '';
  const host = req.headers.host || '';
  const cookies = parseCookies(req.headers.cookie || '');
  const cookieTenant = cookies['clx_tenant'];
  const headerTenant = req.headers['x-tenant-id'];
  const sourceTenant = headerTenant || cookieTenant || null;

  try {
    const t = await resolveTenant(origin, host, sourceTenant);
    if (!t || !t.id) {
      return res.status(400).json({ error: t?.error || 'tenant_not_found' });
    }
    req.tenant = t.id;
    res.locals.tenant_id = t.id;
    // compat voor downstream code die de header leest
    req.headers['x-tenant-id'] = t.id;
    // origins voor CORS (cors middleware leest deze als per-tenant allowlist)
    res.locals.tenant_allowed_origins = Array.isArray(t.allowedOrigins) ? t.allowedOrigins : [];
    return next();
  } catch (e) {
    return res.status(500).json({ error: 'tenant_resolve_failed', detail: e?.message });
  }
}

module.exports = { tenantResolver };
