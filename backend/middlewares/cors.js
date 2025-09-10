// Explicit CORS allow-list with robust preflight handling
const { URL } = require('url');

const parseOrigins = (csv) =>
  (csv || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const allowed = new Set(parseOrigins(process.env.FRONTEND_URLS));
const ANY = process.env.CORS_ANY_ORIGIN === 'true';

// helper to check origin safely
function isAllowed(origin) {
  if (!origin) return false;
  if (ANY) return true;
  try {
    const u = new URL(origin);
    const norm = `${u.protocol}//${u.host}`;
    return allowed.has(norm);
  } catch {
    return false;
  }
}

module.exports = function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  if (origin && isAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin'); // so caches respect origin variance
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // What browsers may send on preflight
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-Requested-With'
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  res.setHeader('Access-Control-Max-Age', '600');

  // Short-circuit all preflights BEFORE any auth/route
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
};
