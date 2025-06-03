import { login, inviteUser } from '../controllers/authController.js';
import express from 'express';
import { supabase } from '../supabaseClient.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';

const router = express.Router();

router.post('/api/login', login);
router.post('/api/invite-user', requireAuth, requireRole(["manager", "superadmin"]), inviteUser);

// Gebruikers ophalen voor deze tenant (manager of superadmin)
router.get('/api/users', requireAuth, requireRole(["manager", "superadmin"]), async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, role, created_at")
    .eq("tenant_id", req.user.tenant_id);
  if (error) return res.status(500).json({ error: "Kan users niet ophalen" });
  res.json({ users: data });
});

// Nieuwe gebruiker toevoegen voor deze tenant (manager of superadmin)
router.post('/api/users', requireAuth, requireRole(["manager", "superadmin"]), async (req, res) => {
  const { email, role, ...rest } = req.body;
  if (!email || !role) return res.status(400).json({ error: "Missing fields" });
  const { error } = await supabase
    .from("users")
    .insert([{ email, role, ...rest, tenant_id: req.user.tenant_id }]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ success: true });
});

export default router;
