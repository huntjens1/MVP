const express = require('express');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, name } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  const payload = {
    uid: email.toLowerCase(),
    email: email.toLowerCase(),
    name: name || email.split('@')[0],
    tenant_id: process.env.DEFAULT_TENANT_ID || 'default',
    role: 'agent',
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '12h',
  });

  const secure = (process.env.COOKIE_SECURE || 'true') === 'true';
  res.cookie('auth', token, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge: 12 * 60 * 60 * 1000,
  });

  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', (req, res) => {
  res.clearCookie('auth', {
    httpOnly: true,
    secure: (process.env.COOKIE_SECURE || 'true') === 'true',
    sameSite: (process.env.COOKIE_SECURE || 'true') === 'true' ? 'none' : 'lax',
  });
  res.json({ ok: true });
});

module.exports = router;
