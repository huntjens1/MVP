/* backend/middlewares/auth.js */
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  try {
    // 1) cookie (auth)
    let raw = req.cookies && req.cookies.auth;

    // 2) Bearer header
    if (!raw) {
      const h = (req.get('authorization') || '').trim();
      if (h.toLowerCase().startsWith('bearer ')) raw = h.slice(7).trim();
    }

    // 3) query token (?token=...)
    if (!raw && typeof req.query?.token === 'string') raw = req.query.token;

    if (!raw) return res.status(401).json({ error: 'Unauthorized' });

    const payload = jwt.verify(raw, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = {
      id: payload.uid,
      tenant_id: payload.tenant_id,
      role: payload.role || 'support'
    };

    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { requireAuth };
