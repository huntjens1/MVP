import express from "express";
import { supabase } from "../supabaseClient.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = express.Router();

// Alle rollen: support, coordinator, manager, superadmin
const allRoles = ["support", "coordinator", "manager", "superadmin"];

// Gesprekken ophalen
router.get("/api/conversations",
  requireAuth,
  requireRole(allRoles),
  async (req, res) => {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("tenant_id", req.user.tenant_id)
      .order("started_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  }
);

// Specifiek gesprek ophalen
router.get("/api/conversations/:id",
  requireAuth,
  requireRole(allRoles),
  async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", req.user.tenant_id)
      .single();
    if (error || !data) return res.status(404).json({ error: "Niet gevonden" });
    res.json(data);
  }
);

// Gesprek aanmaken
router.post("/api/conversations",
  requireAuth,
  requireRole(allRoles),
  async (req, res) => {
    const fields = req.body;
    const { error } = await supabase
      .from("conversations")
      .insert([{ ...fields, tenant_id: req.user.tenant_id }]);
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ success: true });
  }
);

// Gesprek updaten
router.put("/api/conversations/:id",
  requireAuth,
  requireRole(allRoles),
  async (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    const { data: convo, error: checkError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", req.user.tenant_id)
      .single();
    if (checkError || !convo) return res.status(404).json({ error: "Niet gevonden" });

    const { error } = await supabase
      .from("conversations")
      .update(fields)
      .eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  }
);

export default router;
