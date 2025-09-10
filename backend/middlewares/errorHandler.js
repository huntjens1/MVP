// Globale error handler - CommonJS
module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  // Log beknopt in productie; uitgebreider in development
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  } else {
    // eslint-disable-next-line no-console
    console.error('[error]', err.message);
  }

  // Eenduidige JSON respons
  res
    .status(status)
    .json({
      error: err.publicMessage || err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR'
    });
};
