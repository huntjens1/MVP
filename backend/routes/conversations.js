import express from "express";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

// GET /api/conversations - lijst alle gesprekken
router.get("/api/conversations", async (req, res) => {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .order("started_at", { ascending: false }); // nieuwste bovenaan
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Je andere conversation-routes (zoals GET/PUT per ID) kun je hier ook toevoegen

export default router;
