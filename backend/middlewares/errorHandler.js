// Centralized error handler (CommonJS)
module.exports = function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;

  // Don’t leak stack in prod
  const payload = {
    error: err.expose ? err.message : (status >= 500 ? 'Internal Server Error' : err.message || 'Error')
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.stack = err.stack;
    payload.path = req.path;
  }

  res.status(status).json(payload);
};
