// CommonJS export van de middleware-functie zelf
const { URL } = require('url');

const parseOrigins = (csv = '') =>
  csv.split(',').map(s => s.trim()).filter(Boolean);

const allowed = new Set(parseOrigins(process.env.FRONTEND_URLS));
const ANY = process.env.CORS_ANY_ORIGIN === 'true';

function isAllowed(origin) {
  if (!origin) return false;
  if (ANY) return true;
  try {
    const u = new URL(origin);
    return allowed.has(`${u.protocol}//${u.host}`);
  } catch {
    return false;
  }
}

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  if (origin && isAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '600');

  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

module.exports = corsMiddleware;   // <-- exporteer de functie zelf
