// CORS middleware – production safe, met duidelijke logging
const { URL } = require('url');

const parseOrigins = (csv = '') =>
  csv.split(',').map(s => s.trim()).filter(Boolean);

// Zet in Railway: FRONTEND_URLS=https://mvp-zeta-rose.vercel.app
// Optioneel voor test: CORS_ANY_ORIGIN=true
const ANY = String(process.env.CORS_ANY_ORIGIN).toLowerCase() === 'true';
const allowedSet = new Set(parseOrigins(process.env.FRONTEND_URLS));

// Normaliseer tot "protocol//host" (zonder pad of trailing slash)
function normalizeOriginString(s) {
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

function isAllowed(origin) {
  if (!origin) return false;
  if (ANY) return true;
  const norm = normalizeOriginString(origin);
  return allowedSet.has(norm);
}

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  const ok = isAllowed(origin);

  // Log 1 regel per request (handig om in Railway te zien wat er mis is)
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[cors] ${req.method} ${req.originalUrl} origin=${origin || '-'} allowed=${ok} any=${ANY} env=${[...allowedSet].join(',') || '-'}`);
  }

  if (ok) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Voeg hier ALLE headers toe die je frontend stuurt (bijv. X-Tenant-Id)
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-Requested-With'
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  res.setHeader('Access-Control-Max-Age', '600');

  // Behandel preflight snel
  if (req.method === 'OPTIONS') {
    // Als origin niet toegestaan is, antwoordt de server zonder ACAO
    // en zal de browser ’m blokkeren — dat is oké.
    return res.status(204).end();
  }

  next();
}

module.exports = corsMiddleware;
