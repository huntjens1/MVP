// backend/middlewares/auth.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

module.exports = function auth(req, res, next) {
  try {
    const raw = req.headers.cookie || '';
    const cookies = cookie.parse(raw);
    const token = cookies.auth;

    if (!token) {
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, name: payload.name || payload.email };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
};
