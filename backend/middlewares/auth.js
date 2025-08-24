import jwt from 'jsonwebtoken';

/**
 * Leest onze HttpOnly cookie "auth" en zet req.user = { id, tenant_id, role }.
 * Gebruik: router.get('/path', requireAuth, handler)
 */
export function requireAuth(req, res, next) {
  try {
    const raw = req.cookies?.auth;
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
