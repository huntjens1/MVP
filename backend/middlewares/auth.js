const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  try {
    let token = req.cookies?.auth;

    if (!token) {
      const h = (req.get('authorization') || '').trim();
      if (h.toLowerCase().startsWith('bearer ')) token = h.slice(7).trim();
    }
    if (!token && typeof req.query?.token === 'string') token = req.query.token;

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = {
      id: payload.uid,
      email: payload.email,
      name: payload.name,
      tenant_id: payload.tenant_id,
      role: payload.role || 'agent',
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { requireAuth };
