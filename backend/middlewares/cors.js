const cors = require('cors');

function parseAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}
const origins = parseAllowedOrigins();

const strictCors = cors((req, cb) => {
  const origin = req.headers.origin || '';
  const allow = !origin || origins.includes(origin);
  cb(null, {
    origin: allow ? origin : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
    exposedHeaders: ['x-request-id'],
    maxAge: 600,
  });
});

module.exports = { strictCors };
