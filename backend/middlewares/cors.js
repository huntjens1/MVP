// backend/middlewares/cors.js
// Custom CORS met allowlist + regex; credentials enabled; strakke preflight.

const ALLOW_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'X-Requested-With',
];

const ALLOW_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

function parseList(env) {
  return String(env || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function parseRegex(raw) {
  if (!raw) return null;
  try {
    if (raw.startsWith('/') && raw.lastIndexOf('/') > 0) {
      const last = raw.lastIndexOf('/');
      const pat = raw.slice(1, last);
      const flags = raw.slice(last + 1);
      return new RegExp(pat, flags);
    }
    return new RegExp(raw);
  } catch (e) {
    console.error('[cors] invalid ALLOWED_ORIGIN_REGEX', { error: e?.message });
    return null;
  }
}

module.exports = function applyCors() {
  const allowList = parseList(process.env.ALLOWED_ORIGINS);
  const allowRegex = parseRegex(process.env.ALLOWED_ORIGIN_REGEX);

  function isAllowed(origin) {
    if (!origin) return true; // same-origin / curl / server-side
    if (allowList.length && allowList.includes(origin)) return true;
    if (allowRegex && allowRegex.test(origin)) return true;
    return allowList.length === 0 && !allowRegex; // open als niets gezet
  }

  return function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;

    if (!isAllowed(origin)) {
      if (req.method === 'OPTIONS') return res.status(403).end();
      return res.status(403).json({ error: 'CORS_ORIGIN_FORBIDDEN', origin });
    }

    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS.join(', '));
    res.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS.join(', '));

    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  };
};
