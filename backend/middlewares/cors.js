const cors = require('cors');

function decideOrigin(req) {
  const reqOrigin = req.headers.origin || '';
  const tenantOrigins = req.res?.locals?.tenant_allowed_origins || [];
  if (!reqOrigin) return true; // non-browser clients
  return tenantOrigins.includes(reqOrigin) ? reqOrigin : false;
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
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
});

module.exports = { strictCors };
