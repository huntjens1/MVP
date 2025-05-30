import express from "express";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

router.get("/api/analytics/ai-feedback-summary", async (req, res) => {
  // Simple aggregation: per suggestie id het aantal good/bad
  const { data, error } = await supabase.rpc("ai_feedback_summary");
  if (error) {
    console.error("ANALYTICS ERROR:", error);
    return res.status(500).json({ error: "Supabase analytics RPC error" });
  }
  res.json({ summary: data });
});

export default router;
