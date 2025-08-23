import express from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.post('/api/ws-token', requireAuth, async (req, res) => {
  const user = req.user; // verwacht {id, tenant_id, role, ...}
  const token = jwt.sign(
    { uid: user.id, tenant_id: user.tenant_id },
    process.env.WS_JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '10m' }
  );
  res.json({ token });
});

export default router;
