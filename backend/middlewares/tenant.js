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

async function tenantResolver(req, res, next) {
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';
  const cookies = parseCookies(req.headers.cookie || '');
  const cookieTenant = cookies['clx_tenant'];
  const headerTenant = req.headers['x-tenant-id'];
  const sourceTenant = headerTenant || cookieTenant || null;

  try {
    const t = await resolveTenant(origin, host, sourceTenant);
    if (!t || !t.id) return res.status(400).json({ error: t?.error || 'tenant_not_found' });

    req.tenant = t.id;
    res.locals.tenant_id = t.id;
    req.headers['x-tenant-id'] = t.id;
    res.locals.tenant_allowed_origins = Array.isArray(t.allowedOrigins) ? t.allowedOrigins : [];
    return next();
  } catch (e) {
    return res.status(500).json({ error: 'tenant_resolve_failed', detail: e?.message });
  }
}

module.exports = { tenantResolver };
