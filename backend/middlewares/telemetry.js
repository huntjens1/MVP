const { randomUUID } = require('crypto');
const { performance } = require('perf_hooks');

function telemetry(req, res, next) {
  const start = performance.now();
  const rid = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', rid);

  const u = req.user || {};
  const tenantId =
    (u && u.tenant_id) ||
    req.headers['x-tenant-id'] ||
    (typeof req.query.tenant_id === 'string' ? req.query.tenant_id : undefined) ||
    'unknown';

  res.locals.tenant_id = tenantId;
  res.locals.request_id = rid;

  res.on('finish', () => {
    const dur = Math.round(performance.now() - start);
    const log = {
      ts: new Date().toISOString(),
      rid,
      tenant_id: tenantId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: dur,
      ua: req.headers['user-agent'] || '',
    };
    const lvl = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(`[${lvl}]`, JSON.stringify(log));
  });

  next();
}

module.exports = { telemetry };
