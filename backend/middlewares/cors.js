const cors = require('cors');

// Fallback lijst tot tenant-resolve klaar is (en ook als tenant geen origins heeft)
const FALLBACK_LIST = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function decideOrigin(req) {
  const reqOrigin = req.headers.origin || '';
  const tenantOrigins = req.res?.locals?.tenant_allowed_origins || [];
  const allowList = tenantOrigins.length ? tenantOrigins : FALLBACK_LIST;

  if (!reqOrigin) return true;            // non-browser clients
  return allowList.includes(reqOrigin) ? reqOrigin : false;
}

const strictCors = cors((req, cb) => {
  const origin = decideOrigin(req);
  cb(null, {
    origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
    exposedHeaders: ['x-request-id'],
    maxAge: 86400,
    preflightContinue: false,   // cors beantwoordt OPTIONS zelf
    optionsSuccessStatus: 204,
  });
});

module.exports = { strictCors };
