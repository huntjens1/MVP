// Tenant + user mapping resolvers via Supabase REST.
// Tabellen: public.tenants(id,name,domain), public.tenant_users(tenant_id,email,role,active)

const CACHE_TTL_MS = 60_000;
const cache = new Map(); // key -> { val, exp }
const putCache = (k, v) => cache.set(k, { val: v, exp: Date.now() + CACHE_TTL_MS });
const getCache = (k) => {
  const v = cache.get(k);
  if (!v) return null;
  if (Date.now() > v.exp) { cache.delete(k); return null; }
  return v.val;
};

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

function hostFrom(origin, hostHeader) {
  if (origin) { try { return new URL(origin).host; } catch {}
  }
  if (hostHeader) return String(hostHeader).split(':')[0];
  return null;
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

/* ------------ Tenant lookups ------------ */
async function getTenantById(id) {
  if (!id) return null;
  const base = process.env.SUPABASE_URL;
  const url = `${base.replace(/\/$/, '')}/rest/v1/tenants?select=id,name,domain&id=eq.${encodeURIComponent(id)}&limit=1`;
  const rows = await fetchJSON(url, supabaseHeaders());
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
async function getTenantByName(name) {
  if (!name) return null;
  const base = process.env.SUPABASE_URL;
  const url = `${base.replace(/\/$/, '')}/rest/v1/tenants?select=id,name,domain&name=eq.${encodeURIComponent(name)}&limit=1`;
  const rows = await fetchJSON(url, supabaseHeaders());
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
async function getTenantByDomain(domain) {
  if (!domain) return null;
  const base = process.env.SUPABASE_URL;
  const url = `${base.replace(/\/$/, '')}/rest/v1/tenants?select=id,name,domain&domain=eq.${encodeURIComponent(domain)}&limit=1`;
  const rows = await fetchJSON(url, supabaseHeaders());
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

/** Mapping uit tenant_users; geeft { tenant, role } of null */
async function getTenantForUserEmail(email) {
  const base = process.env.SUPABASE_URL;
  const e = String(email || '').toLowerCase().trim();
  if (!e) return null;

  const ck = `user:${e}`;
  const cached = getCache(ck);
  if (cached !== null) return cached;

  const url = `${base.replace(/\/$/, '')}/rest/v1/tenant_users?select=tenant_id,role,active&email=eq.${encodeURIComponent(e)}&active=eq.true&limit=1`;
  const rows = await fetchJSON(url, supabaseHeaders());
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!row?.tenant_id) { putCache(ck, null); return null; }

  const tenant = await getTenantById(row.tenant_id);
  const out = tenant ? { tenant, role: row.role || 'agent' } : null;
  putCache(ck, out);
  return out;
}

/** Default tenant uit env: DEFAULT_TENANT_ID of DEFAULT_TENANT_NAME */
async function getDefaultTenantFromEnv() {
  if (process.env.DEFAULT_TENANT_ID) {
    const t = await getTenantById(process.env.DEFAULT_TENANT_ID);
    if (t?.id) return t;
  }
  if (process.env.DEFAULT_TENANT_NAME) {
    const t = await getTenantByName(process.env.DEFAULT_TENANT_NAME);
    if (t?.id) return t;
  }
  return null;
}

/** Middleware-resolver (na login), met DEFAULT_TENANT fallback */
async function resolveTenant(origin, hostHeader, headerOrCookieTenant) {
  const host = hostFrom(origin, hostHeader);
  const cacheKey = `h=${host}|hdr=${headerOrCookieTenant || ''}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  let byDomain = null;
  if (host) { try { byDomain = await getTenantByDomain(host); } catch {} }

  let byHeader = null;
  if (headerOrCookieTenant) { try { byHeader = await getTenantById(headerOrCookieTenant); } catch {} }

  const allowDefault = process.env.ALLOW_DEFAULT_TENANT === '1';
  let picked = byDomain || byHeader;
  if (!picked && allowDefault) {
    picked = await getDefaultTenantFromEnv();
  }

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
  getTenantForUserEmail,
  getTenantByEmailDomain,
  getDefaultTenantFromEnv,
};
