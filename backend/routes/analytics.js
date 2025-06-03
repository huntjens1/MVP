import express from "express";
import { supabase } from "../supabaseClient.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = express.Router();

// Alleen manager en superadmin
router.get("/api/analytics/ai-feedback-summary",
  requireAuth,
  requireRole(["manager", "superadmin"]),
  async (req, res) => {
    const { data, error } = await supabase.rpc("ai_feedback_summary", {
      tenant_id: req.user.tenant_id
    });
    if (error) {
      return res.status(500).json({ error: "Supabase analytics RPC error" });
    }
    res.json({ summary: data });
  }
);

export default router;
