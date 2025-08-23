export function errorHandler(err, req, res, next) {
  const code = err.status || 500;
  const msg = code === 500 ? 'Internal Server Error' : err.message;
  if (process.env.NODE_ENV !== 'production') {
    console.error('ERROR:', { code, msg, stack: err.stack?.split('\n').slice(0,3).join('\n') });
  }
  res.status(code).json({ error: msg });
}
