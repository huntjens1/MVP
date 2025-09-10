const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
];

function corsMiddleware() {
  return (req, res, next) => {
    const cfg = (process.env.FRONTEND_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    const allowlist = cfg.length ? cfg : DEFAULT_ORIGINS;
    const origin = req.headers.origin;

    if (origin && allowlist.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Expose-Headers', 'x-request-id');
    }

    // altijd deze headers toestaan (voor preflight & SSE)
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',
      'authorization, content-type, x-requested-with');

    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
}

module.exports = { corsMiddleware };
