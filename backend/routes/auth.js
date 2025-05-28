import { login, inviteUser } from '../controllers/authController.js';
import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

router.post('/api/login', login);
router.post('/api/invite-user', inviteUser);

// Voeg deze GET-route toe:
router.get('/api/tenants', async (req, res) => {
  const { data, error } = await supabase.from("tenants").select("id, name");
  if (error) return res.status(500).json({ error: "Kan tenants niet ophalen" });
  res.json({ tenants: data });
});

export default router;
