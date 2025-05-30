import express from "express";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

router.post("/api/ai-feedback", async (req, res) => {
  const { suggestion_id, suggestion_text, conversation_id, user_id, feedback } = req.body;
  if (!suggestion_id || !suggestion_text || !conversation_id || !user_id || !feedback) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const { error } = await supabase
    .from('ai_suggestion_feedback')
    .insert([{ suggestion_id, suggestion_text, conversation_id, user_id, feedback }]);
  if (error) {
    console.error("SUPABASE FEEDBACK ERROR:", error);
    return res.status(500).json({ error: "Failed to log feedback" });
  }
  res.json({ success: true });
});

export default router;
