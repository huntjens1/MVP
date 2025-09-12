// backend/middlewares/errorHandler.js
module.exports = function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const payload = {
    id: req.id,
    method: req.method,
    path: req.originalUrl,
    message: err?.message || 'Internal Server Error',
  };

  if (process.env.NODE_ENV !== 'production') {
    console.error('[error]', { ...payload, stack: err?.stack });
  } else {
    console.error('[error]', payload);
  }

  res.status(status).json({
    error: err.publicMessage || err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
  });
};
