import express from "express";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

// POST /api/conversations/:id/transcripts/deepgram
router.post("/api/conversations/:id/transcripts/deepgram", async (req, res) => {
  const { id } = req.params;
  const { deepgram } = req.body; // de volledige Deepgram-response
  if (!deepgram || !deepgram.channel || !deepgram.channel.alternatives?.[0]?.transcript) {
    return res.status(400).json({ error: "Invalid Deepgram data" });
  }
  const words = deepgram.channel.alternatives[0].words;
  if (!words || !Array.isArray(words)) {
    return res.status(400).json({ error: "No word data in Deepgram output" });
  }
  let fragments = [];
  let fragment = null;
  words.forEach((w, i) => {
    if (!fragment) {
      fragment = {
        start_time: w.start,
        end_time: w.end,
        speaker: w.speaker,
        speaker_label: w.speaker === 0 ? "Agent" : "Gebruiker",
        content: w.punctuated_word || w.word,
      };
    } else if (w.speaker === fragment.speaker && w.start - fragment.end_time < 1.5) {
      fragment.end_time = w.end;
      fragment.content += (w.punctuated_word || " " + w.word);
    } else {
      fragments.push({ ...fragment });
      fragment = {
        start_time: w.start,
        end_time: w.end,
        speaker: w.speaker,
        speaker_label: w.speaker === 0 ? "Agent" : "Gebruiker",
        content: w.punctuated_word || w.word,
      };
    }
    if (i === words.length - 1 && fragment) {
      fragments.push({ ...fragment });
    }
  });

  const rows = fragments.map(f => ({
    conversation_id: id,
    start_time: f.start_time,
    end_time: f.end_time,
    speaker: f.speaker,
    speaker_label: f.speaker_label,
    content: f.content,
  }));
  const { error } = await supabase.from("transcripts").insert(rows);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, inserted: rows.length });
});

// GET /api/conversations/:id/transcripts
router.get("/api/conversations/:id/transcripts", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from("transcripts")
    .select("*")
    .eq("conversation_id", id)
    .order("start_time", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
