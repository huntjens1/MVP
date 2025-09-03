// Tenant-resolving via Supabase (tabel tenants: id uuid, name text, domain text, created_at).
// - resolveTenant(): gebruikt Origin/Host + optionele header/cookie
// - getTenantByEmailDomain(): zoekt tenant obv e-maildomein (na '@')

const CACHE_TTL_MS = 60_000;
const cache = new Map(); // key -> { val, exp }

function putCache(key, val) { cache.set(key, { val, exp: Date.now() + CACHE_TTL_MS }); }
function getCache(key) {
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() > v.exp) { cache.delete(key); return null; }
  return v.val;
}

function hostFrom(origin, hostHeader) {
  if (origin) { try { return new URL(origin).host; } catch {} }
  if (hostHeader) return String(hostHeader).split(':')[0];
  return null;
}

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' };
}

async function fetchJSON(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Supabase error ${res.status} ${t}`);
  }
  return res.json();
}

async function getTenantByDomain(domain) {
  if (!domain) return null;
  const base = process.env.SUPABASE_URL;
  if (!base) throw new Error('SUPABASE_URL missing');
  const endpoint = `${base.replace(/\/$/, '')}/rest/v1/tenants?select=id,name,domain&domain=eq.${encodeURIComponent(domain)}&limit=1`;
  const rows = await fetchJSON(endpoint, supabaseHeaders());
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function getTenantByIdOrName(idOrName) {
  if (!idOrName) return null;
  const base = process.env.SUPABASE_URL;
  if (!base) throw new Error('SUPABASE_URL missing');
  const enc = encodeURIComponent(idOrName);
  const endpoint = `${base.replace(/\/$/, '')}/rest/v1/tenants?select=id,name,domain&or=(id.eq.${enc},name.eq.${enc})&limit=1`;
  const rows = await fetchJSON(endpoint, supabaseHeaders());
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function emailDomain(email) {
  const m = String(email || '').toLowerCase().match(/@([^>\s]+)/);
  return m ? m[1] : null;
}

async function getTenantByEmailDomain(email) {
  const d = emailDomain(email);
  if (!d) return null;
  return await getTenantByDomain(d);
}

function computeAllowedOrigins(tenantRow) {
  const envList = String(process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const arr = [...envList];
  if (tenantRow?.domain) {
    const d = String(tenantRow.domain).trim();
    if (d) arr.push(`https://${d}`);
  }
  return Array.from(new Set(arr));
}

async function resolveTenant(origin, hostHeader, headerOrCookieTenant) {
  const host = hostFrom(origin, hostHeader);
  const cacheKey = `h=${host}|hdr=${headerOrCookieTenant || ''}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  let byDomain = null;
  if (host) { try { byDomain = await getTenantByDomain(host); } catch {} }

  let byHeader = null;
  if (headerOrCookieTenant) { try { byHeader = await getTenantByIdOrName(headerOrCookieTenant); } catch {} }

  if (byDomain && headerOrCookieTenant && byHeader && String(byHeader.id) !== String(byDomain.id)) {
    const out = { id: null, name: null, domain: host, error: 'tenant_header_mismatch', allowedOrigins: computeAllowedOrigins(byDomain) };
    putCache(cacheKey, out); return out;
  }

  const picked = byDomain || byHeader || (process.env.DEFAULT_TENANT_ID ? { id: process.env.DEFAULT_TENANT_ID, name: 'default', domain: null } : null);
  if (!picked) {
    const out = { id: null, name: null, domain: host, error: 'tenant_not_found', allowedOrigins: computeAllowedOrigins(null) };
    putCache(cacheKey, out); return out;
  }

  const out = {
    id: String(picked.id),
    name: picked.name ? String(picked.name) : null,
    domain: picked.domain ? String(picked.domain) : null,
    allowedOrigins: computeAllowedOrigins(picked),
  };
  putCache(cacheKey, out);
  return out;
}

module.exports = {
  resolveTenant,
  getTenantByEmailDomain,
};
