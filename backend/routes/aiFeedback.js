import express from "express";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

router.post("/api/ai-feedback", async (req, res) => {
  console.log("FEEDBACK BODY:", req.body);  // <-- Logt alles wat wordt ontvangen
  const { suggestion_id, conversation_id, user_id, feedback } = req.body;
  if (!suggestion_id || !conversation_id || !user_id || !feedback) {
    console.error("FEEDBACK ERROR: Missing fields", req.body);
    return res.status(400).json({ error: "Missing fields" });
  }
  const { error } = await supabase
    .from('ai_suggestion_feedback')
    .insert([{ suggestion_id, conversation_id, user_id, feedback }]);
  if (error) {
    console.error("SUPABASE ERROR:", error);  // <-- Logt de echte Supabase error
    return res.status(500).json({ error: "Failed to log feedback" });
  }
  res.json({ success: true });
});

export default router;
