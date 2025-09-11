// backend/middlewares/auth.js (CommonJS)
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth';

// ===== helpers =====
function readTokenFromReq(req) {
  // 1) Authorization: Bearer <token>
  const hdr = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(hdr);
  if (m) return m[1];

  // 2) signed cookie (preferred if you use cookie-parser with a secret)
  if (req.signedCookies && req.signedCookies[AUTH_COOKIE_NAME]) {
    return req.signedCookies[AUTH_COOKIE_NAME];
  }
  // 3) plain cookie
  if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
    return req.cookies[AUTH_COOKIE_NAME];
  }
  return null;
}

function signToken(payload, opts = {}) {
  // payload kan o.a. { id, email, tenant_id, roles } bevatten
  return jwt.sign(payload, JWT_SECRET, {
    issuer: 'calllogix',
    expiresIn: opts.expiresIn || '7d',
    ...opts,
  });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, { issuer: 'calllogix' });
}

// ===== middlewares =====
function requireAuth(req, res, next) {
  try {
    const token = readTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'unauthorized' });

    const payload = verifyToken(token);
    req.user = payload; // beschikbaar voor routes
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

function optionalAuth(req, _res, next) {
  try {
    const token = readTokenFromReq(req);
    if (token) {
      req.user = verifyToken(token);
    }
  } catch (_e) {
    // negeren: optioneel
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    if (!roles.includes(role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

// CommonJS exports (zodat destructuring werkt)
module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  signToken,
  verifyToken,
};
