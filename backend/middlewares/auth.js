import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  try {
    // 1) Cookie (oude weg)
    let raw = req.cookies?.auth;

    // 2) Bearer header (Authorization: Bearer <jwt>)
    if (!raw) {
      const h = req.get('authorization') || '';
      if (h.toLowerCase().startsWith('bearer ')) raw = h.slice(7).trim();
    }

    // 3) Query token (?token=...)
    if (!raw && typeof req.query?.token === 'string') {
      raw = req.query.token;
    }

    if (!raw) return res.status(401).json({ error: 'Unauthorized' });

    const payload = jwt.verify(raw, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = {
      id: payload.uid,
      tenant_id: payload.tenant_id,
      role: payload.role || 'support',
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
