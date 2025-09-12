// backend/middlewares/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth';

function readTokenFromReq(req) {
  const hdr = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(hdr);
  if (m) return m[1];
  if (req.signedCookies && req.signedCookies[AUTH_COOKIE_NAME]) return req.signedCookies[AUTH_COOKIE_NAME];
  if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) return req.cookies[AUTH_COOKIE_NAME];
  return null;
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function requireAuth(req, res, next) {
  const token = readTokenFromReq(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'invalid_token' });
  req.user = { id: payload.sub, email: payload.email, name: payload.name };
  next();
}

function optionalAuth(req, _res, next) {
  const token = readTokenFromReq(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.user = { id: payload.sub, email: payload.email, name: payload.name };
  }
  next();
}

function requireRole(roles = []) {
  const set = new Set(Array.isArray(roles) ? roles : [roles]);
  return (req, res, next) => {
    const role = req.user?.role || 'user';
    if (!set.size || set.has(role)) return next();
    return res.status(403).json({ error: 'forbidden' });
  };
}

function signToken(user, { expiresIn = '7d' } = {}) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role || 'user' }, JWT_SECRET, { expiresIn });
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  signToken,
  verifyToken,
};
