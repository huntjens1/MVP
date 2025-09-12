// backend/middlewares/debug.js
const { randomUUID } = require('crypto');

function redact(obj = {}, max = 500) {
  const out = {};
  for (const k of Object.keys(obj || {})) {
    const v = obj[k];
    if (v == null) continue;
    const s = typeof v === 'string' ? v : safeJson(v);
    out[k] = s.length > max ? `${s.slice(0, max)}…(${s.length}b)` : s;
  }
  return out;
}

function safeJson(v) {
  try { return JSON.stringify(v); } catch { return String(v); }
}

function requestLogger({ logBodies = false } = {}) {
  return (req, res, next) => {
    const id = randomUUID();
    req.id = id;
    res.setHeader('X-Request-Id', id);

    const start = Date.now();

    const ctx = {
      id,
      method: req.method,
      path: req.originalUrl,
      origin: req.headers.origin,
    };

    console.debug('[http] req', {
      ...ctx,
      body: logBodies ? redact(req.body) : undefined,
      cookie: req.headers?.cookie ? 'present' : 'absent',
    });

    res.on('finish', () => {
      const ms = Date.now() - start;
      const status = res.statusCode;
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'debug';
      const payload = {
        ...ctx,
        status,
        ms,
        user: req.user ? { id: req.user.id, email: req.user.email } : null,
      };
      console[level === 'debug' ? 'debug' : level]('[http] res', payload);
    });

    next();
  };
}

module.exports = { requestLogger };
