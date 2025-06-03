import express from "express";
import { supabase } from "../supabaseClient.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = express.Router();
const allRoles = ["support", "coordinator", "manager", "superadmin"];

// Feedback posten
router.post("/api/ai-feedback",
  requireAuth,
  requireRole(allRoles),
  async (req, res) => {
    const { suggestion_id, suggestion_text, conversation_id, user_id, feedback } = req.body;
    if (!suggestion_id || !suggestion_text || !conversation_id || !user_id || !feedback) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const { data: convo, error: convoErr } = await supabase
      .from("conversations")
      .select("tenant_id")
      .eq("id", conversation_id)
      .single();
    if (convoErr || !convo || convo.tenant_id !== req.user.tenant_id) {
      return res.status(403).json({ error: "Geen toegang tot deze conversation" });
    }

    const { error } = await supabase
      .from("ai_suggestion_feedback")
      .insert([{ suggestion_id, suggestion_text, conversation_id, user_id, feedback, tenant_id: req.user.tenant_id }]);
    if (error) {
      return res.status(500).json({ error: "Failed to log feedback" });
    }
    res.json({ success: true });
  }
);

export default router;
