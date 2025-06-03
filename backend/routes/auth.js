import { login, inviteUser } from '../controllers/authController.js';
import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

router.post('/api/login', login);
router.post('/api/invite-user', inviteUser);

// Voeg deze GET-route toe:
router.get('/api/users', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, role, created_at")
    .eq("tenant_id", req.user.tenant_id);
  if (error) return res.status(500).json({ error: "Kan users niet ophalen" });
  res.json({ users: data });
});

await supabase
  .from("users")
  .insert([{ ...userData, tenant_id: req.user.tenant_id }]);

export default router;
