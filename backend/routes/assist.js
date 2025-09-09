// backend/routes/assist.js
const express = require("express");
const router = express.Router();
const { subscribe, emit } = require("../streams/assistSSE");

// OpenAI via native fetch
async function generateAssist(contextText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const body = {
    model: process.env.OPENAI_SUGGEST_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          [
            "Je bent een ITIL v4 servicedesk-assistent.",
            "Bepaal de intent (incident|service_request|howto|status|access|password_reset|hardware|software|network|other).",
            "Geef 'next_best_actions' (max 3 korte, uitvoerbare stappen).",
            "Geef 'runbook_steps' (max 5, concreet met imperatieven).",
            "Antwoord in STRIKT JSON met velden: {intent, next_best_actions: string[], runbook_steps: string[]}.",
          ].join(" "),
      },
      { role: "user", content: `Context (laatste zinnen):\n${contextText}` },
    ],
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`OpenAI ${r.status}: ${txt}`);
  }

  const data = await r.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = { intent: "other", next_best_actions: [], runbook_steps: [] }; }
  const nba = (Array.isArray(parsed.next_best_actions) ? parsed.next_best_actions : []).map(s => String(s).trim()).filter(Boolean).slice(0,3);
  const rb  = (Array.isArray(parsed.runbook_steps) ? parsed.runbook_steps : []).map(s => String(s).trim()).filter(Boolean).slice(0,5);
  const intent = String(parsed.intent || "other");
  return { intent, next_best_actions: nba, runbook_steps: rb };
}

// POST /api/assist { conversation_id, text }
router.post("/", async (req, res) => {
  try {
    const { conversation_id, text } = req.body || {};
    if (!conversation_id || !text) return res.status(400).json({ error: "conversation_id_and_text_required" });

    const out = await generateAssist(text);
    const payload = { conversation_id, ...out, ts: Date.now() };
    emit(conversation_id, payload);
    res.json(payload);
  } catch (err) {
    console.error("[assist] error:", err);
    res.status(500).json({ error: "assist_failed" });
  }
});

// GET /api/assist/stream?conversation_id=...
router.get("/stream", (req, res) => {
  const { conversation_id } = req.query || {};
  if (!conversation_id) return res.status(400).send("conversation_id required");
  subscribe(conversation_id, res);
});

module.exports = router;
