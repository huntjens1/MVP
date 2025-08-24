import express from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

/**
 * Geeft een short-lived token terug dat we meesturen naar de /ws/mic connectie.
 * Vereist ingelogde user (cookie 'auth').
 */
router.post('/api/ws-token', requireAuth, (req, res) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Duidelijke fout i.p.v. crash
    return res.status(500).json({ error: 'JWT_SECRET ontbreekt op de server' });
  }
  const payload = {
    uid: req.user.id,
    tenant_id: req.user.tenant_id,
    role: req.user.role || 'support',
  };
  // Kort geldige token om risico te beperken
  const token = jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '2m' });
  return res.json({ token });
});

export default router;
