// middlewares/debug.js
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

function redact(obj = {}, max = 500) {
  // redigeer potentieel gevoelige of te grote payloads
  const clone = {};
  for (const k of Object.keys(obj || {})) {
    const v = obj[k];
    if (v == null) continue;
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    clone[k] = s.length > max ? `${s.slice(0, max)}…(${s.length}b)` : s;
  }
  return clone;
}

function requestLogger() {
  return (req, res, next) => {
    // koppel een request id
    req.id = req.id || randomUUID().slice(0, 8);
    const start = process.hrtime.bigint();

    // basiscontext
    const base = {
      id: req.id,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      method: req.method,
      path: req.originalUrl || req.url
    };

    logger.info('REQ', { ...base, ua: req.headers['user-agent'] });

    // als response klaar is, log status + duur
    res.on('finish', () => {
      const durMs = Number(process.hrtime.bigint() - start) / 1e6;
      const ctx = {
        ...base,
        status: res.statusCode,
        ms: Math.round(durMs)
      };

      if (res.statusCode >= 400) {
        // uitgebreide debug bij fout
        logger.error('RES', {
          ...ctx,
          query: redact(req.query),
          params: redact(req.params),
          body: redact(req.body),
          cookie: req.headers?.cookie ? 'present' : 'absent',
          user: req.user ? { id: req.user.id, email: req.user.email } : null
        });
      } else {
        logger.info('RES', ctx);
      }
    });

    next();
  };
}

module.exports = { requestLogger };
