import express from "express";
import { supabase } from "../supabaseClient.js";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

router.get("/api/analytics/ai-feedback-summary", requireAuth, async (req, res) => {
  // Filter analytics op tenant_id als mogelijk
  // (eventueel in je Supabase view/functie al tenant_id toevoegen)
  const { data, error } = await supabase.rpc("ai_feedback_summary", {
    tenant_id: req.user.tenant_id // Alleen mogelijk als functie deze param accepteert
  });
  if (error) {
    console.error("ANALYTICS ERROR:", error);
    return res.status(500).json({ error: "Supabase analytics RPC error" });
  }
  res.json({ summary: data });
});

export default router;
