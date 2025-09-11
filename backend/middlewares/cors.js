// backend/middlewares/cors.js
// Hardened CORS middleware with allowlist + regex + proper preflight handling.
const DEFAULT_ALLOW_LIST = [
  'https://mvp-zeta-rose.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// Covers preview deployments like https://mvp-zeta-rose-xyz123.vercel.app
const DEFAULT_REGEX = /^https:\/\/mvp-zeta-rose(?:-[a-z0-9-]+)?\.vercel\.app$/i;

function parseRegexFromEnv() {
  const raw = process.env.ALLOWED_ORIGIN_REGEX;
  if (!raw) return null;
  try {
    // Allow both "pattern" and "/pattern/flags" styles
    const m = raw.match(/^\/(.+)\/([imuygs]*)$/);
    return new RegExp(m ? m[1] : raw, m ? m[2] : 'i');
  } catch (e) {
    console.warn('[cors] Invalid ALLOWED_ORIGIN_REGEX:', raw, e.message);
    return null;
  }
}

const allowList = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (allowList.length === 0) {
  // Safe defaults so deployments blijven werken als envs ontbreken.
  allowList.push(...DEFAULT_ALLOW_LIST);
}

const allowRegex = parseRegexFromEnv() || DEFAULT_REGEX;
const anyOrigin = String(process.env.ANY_ORIGIN || '').toLowerCase() === 'true';

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (anyOrigin) return true;
  if (allowList.includes(origin)) return true;
  try {
    return allowRegex.test(origin);
  } catch {
    return false;
  }
}

function setCorsHeaders(res, origin) {
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length,Content-Type');
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
}

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin || '';
  const ok = isAllowedOrigin(origin);

  if (process.env.DEBUG_CORS) {
    console.log(
      '[cors]',
      req.method,
      req.path,
      'origin=',
      origin || '(none)',
      'ok=',
      ok,
      'list=',
      allowList,
      'regex=',
      String(allowRegex),
      'any=',
      anyOrigin
    );
  }

  // Geen origin? Gewoon door.
  if (!origin) return next();

  if (!ok) {
    // Preflight of echte call wordt hier bewust geblokkeerd
    if (req.method === 'OPTIONS') return res.status(403).end();
    return res.status(403).json({ error: 'CORS_ORIGIN_FORBIDDEN', origin });
  }

  setCorsHeaders(res, origin);

  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
}

module.exports = corsMiddleware;
