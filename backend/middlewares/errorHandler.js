// backend/middlewares/errorHandler.js
'use strict';

/**
 * Express error handler – AVG/ITIL vriendelijk:
 * - Logt fout (zonder gevoelige payloads)
 * - Verstuurt generieke boodschap in productie
 * - Stuurt trace info alleen buiten productie
 */
module.exports = function errorHandler(err, req, res, _next) {
  // statuscode bepalen
  const status =
    (typeof err.status === 'number' && err.status) ||
    (typeof err.statusCode === 'number' && err.statusCode) ||
    500;

  // veilig, niet-verklappende message voor prod
  const isProd = process.env.NODE_ENV === 'production';
  const safeMessage =
    status >= 500
      ? 'Er is iets misgegaan aan onze kant.'
      : (err.publicMessage || err.message || 'Onbekende fout.');

  // trace & id’s (handig voor ITIL incident linking)
  const requestId =
    req.headers['x-request-id'] ||
    req.id ||
    res.getHeader('x-request-id') ||
    null;

  // Log beperkt en veilig (zonder body / secrets)
  // Sluit evt. je eigen logger in via req.app.get('logger')
  const logger =
    (req.app && req.app.get && req.app.get('logger')) || console;
  logger.error(
    {
      requestId,
      status,
      path: req.originalUrl,
      method: req.method,
      // beknopte foutinfo
      name: err.name,
      code: err.code || err.type || undefined,
      // stack alleen buiten prod loggen
      stack: isProd ? undefined : err.stack,
    },
    'Unhandled error'
  );

  const payload = {
    ok: false,
    status,
    message: safeMessage,
    requestId,
    // Alleen buiten productie extra details meesturen
    ...(isProd
      ? null
      : {
          error: {
            name: err.name,
            code: err.code || err.type || undefined,
            details:
              typeof err.expose === 'boolean' && err.expose
                ? err // door middleware als veilig gemarkeerd
                : {
                    // minimale debug info
                    message: err.message,
                    stack: err.stack,
                  },
          },
        }),
    timestamp: new Date().toISOString(),
  };

  // Zorg dat we niet twee keer headers sturen
  if (res.headersSent) {
    return res.end();
  }
  res.status(status).json(payload);
};
