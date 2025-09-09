// backend/routes/ticket.js
const express = require("express");
const router = express.Router();

// impact×urgency -> priority + TTR (min) (ITIL-achtig matrix; pas waar nodig aan)
const MATRIX = {
  Low:    { Low: "P4", Medium: "P4", High: "P3", Critical: "P3" },
  Medium: { Low: "P4", Medium: "P3", High: "P2", Critical: "P2" },
  High:   { Low: "P3", Medium: "P2", High: "P2", Critical: "P1" },
  Critical:{ Low: "P3", Medium: "P2", High: "P1", Critical: "P1" },
};
const TTR = { P1: 60, P2: 240, P3: 1440, P4: 2880 };

async function buildSkeleton(contextText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const sys = [
    "Je bent een ITIL v4 servicedesk-assistent.",
    "Extraheer ticket-velden; maskeer PII (wachtwoorden/CC/BSN/telefoon/e-mail) met ***.",
    "Antwoord in strikt JSON: {title, category, impact, urgency, ci, tags, description}.",
    "impact/urgency ∈ {Low,Medium,High,Critical}.",
  ].join(" ");

  const prompt = `Context (laatste zinnen):\n${contextText}`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_SUGGEST_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
    }),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`OpenAI ${r.status}: ${txt}`);
  }

  const data = await r.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  let s; try { s = JSON.parse(raw); } catch { s = {}; }

  const impact = ["Low","Medium","High","Critical"].includes(s.impact) ? s.impact : "Low";
  const urgency = ["Low","Medium","High","Critical"].includes(s.urgency) ? s.urgency : "Low";
  const prio = (MATRIX[impact] && MATRIX[impact][urgency]) || "P4";
  const ttr = TTR[prio] || 2880;

  return {
    title: s.title || "Onbenoemd incident",
    category: s.category || "Overig",
    impact, urgency,
    priority: prio,
    ttr_minutes: ttr,
    ci: s.ci || null,
    tags: Array.isArray(s.tags) ? s.tags.slice(0,6) : [],
    description: s.description || "",
  };
}

// POST /api/ticket/skeleton { conversation_id, text }
router.post("/skeleton", async (req, res) => {
  try {
    const { conversation_id, text } = req.body || {};
    if (!conversation_id || !text) return res.status(400).json({ error: "conversation_id_and_text_required" });
    const skeleton = await buildSkeleton(text);
    res.json({ conversation_id, skeleton, ts: Date.now() });
  } catch (err) {
    console.error("[ticket] error:", err);
    res.status(500).json({ error: "ticket_skeleton_failed" });
  }
});

module.exports = router;
