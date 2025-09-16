// backend/routes/assist.js
// POST /api/assist  +  SSE broadcast naar assistSSE
const express = require("express");
const router = express.Router();
const { publish: pushAssist } = require("../streams/assistSSE");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.ASSIST_MODEL || "gpt-4o-mini";

function cleanText(s) {
  if (!s) return "";
  let t = String(s).trim();
  t = t.replace(/\s*[{[].*[\]}]\s*$/s, "");
  t = t.replace(/^\s*[-*•\d\)\.]+\s*/g, "");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function normalizeArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(cleanText).filter(Boolean);
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) return parsed.map(cleanText).filter(Boolean);
  } catch {}
  return String(raw)
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*[-*•\d\)\.]+\s*/, ""))
    .map(cleanText)
    .filter(Boolean);
}

router.post("/api/assist", async (req, res) => {
  const t0 = Date.now();
  try {
    const user = req.user?.email || null;
    const { conversation_id, transcript } = req.body || {};
    if (!conversation_id) return res.status(400).json({ error: "conversation_id is required" });

    let actions = [];
    try {
      const system = [
        "Je bent een NL servicedesk-assistent (ITIL v4).",
        "Geef concrete, uitvoerbare stappen (Next-Best-Actions) voor de agent.",
        "Uitsluitend puntsgewijze stappen; geen JSON, geen lange verhalen. 3–6 items."
      ].join(" ");
      const prompt = `Context:
"""${(transcript || "").slice(0, 1600)}"""
Geef 3–6 concrete stappen (één per regel).`;

      const r = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      });

      const raw = r.choices?.[0]?.message?.content || "";
      actions = normalizeArray(raw);
    } catch (err) {
      console.log("[assist] openai error", { error: String(err) });
    }

    if (actions.length === 0) {
      actions = [
        "Vraag om exacte foutmelding en laatste werkende moment.",
        "Bepaal impact (aantal gebruikers/locaties) en urgentie.",
        "Herproduceer het probleem en leg bevindingen vast.",
      ];
    }

    pushAssist(conversation_id, { conversation_id, actions });

    console.log("[assist] emitted", {
      conversation_id,
      actions: actions.length,
      user,
      ms: Date.now() - t0,
    });

    return res.json({ suggestion: actions[0] || null, actions });
  } catch (err) {
    console.log("[assist] error", { error: String(err) });
    return res.status(500).json({ error: "assist_failed" });
  }
});

module.exports = router;
