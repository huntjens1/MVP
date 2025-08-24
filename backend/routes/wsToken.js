import express from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.post('/api/ws-token', requireAuth, (req, res) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ error: 'JWT_SECRET ontbreekt' });

  const payload = {
    uid: req.user.id,
    tenant_id: req.user.tenant_id,
    role: req.user.role || 'support',
  };
  const token = jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '10m' });
  return res.json({ token });
});

export default router;
