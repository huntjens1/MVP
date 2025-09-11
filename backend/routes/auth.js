// backend/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// MVP: replace with your real user lookup later (e.g., DB)
async function validate(email, password) {
  // simple MVP rule: accept the configured DEMO credentials or any non-empty
  const demoUser = (process.env.DEMO_USER || '').toLowerCase();
  const demoPass = process.env.DEMO_PASS || '';

  if (demoUser && demoPass) {
    return email.toLowerCase() === demoUser && password === demoPass;
  }
  return Boolean(email && password);
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'MISSING_CREDENTIALS' });
    }

    const ok = await validate(email, password);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS' });
    }

    const user = { id: email.toLowerCase(), email: email.toLowerCase() };

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set cookie for cross-site use from Vercel → Railway
    res.cookie('auth', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'LOGIN_ERROR' });
  }
});

module.exports = router;
