// backend/routes/suggest.js
const express = require("express");
const router = express.Router();
const { subscribe, emit } = require("../streams/suggestionsSSE");

// OpenAI via native fetch (Node 18+)
async function generateSuggestions(promptText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const body = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Je bent een ITIL v4 servicedesk-assistent. Geef maximaal 3 korte, concrete vervolgvraag-suggesties om een ticket sneller op te lossen. Antwoord in JSON met {\"suggestions\":[\"...\",\"...\"]}. Geen uitleg, geen extra velden.",
      },
      {
        role: "user",
        content: `Context (laatste klant/agent zinnen):\n${promptText}\n\nGeef nu nieuwe vervolgvraag-suggesties.`,
      },
    ],
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`OpenAI ${r.status}: ${txt}`);
  }

  const data = await r.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = { suggestions: [] }; }

  const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  return list
    .map(s => String(s).trim())
    .filter(Boolean)
    .slice(0, 3);
}

// POST /api/suggest  { conversation_id, text }
router.post("/", async (req, res) => {
  try {
    const { conversation_id, text } = req.body || {};
    if (!conversation_id || !text) {
      return res.status(400).json({ error: "conversation_id_and_text_required" });
    }

    const suggestions = await generateSuggestions(text);
    const payload = { conversation_id, suggestions, ts: Date.now() };

    // duw naar alle SSE-clients van dit gesprek
    emit(conversation_id, payload);

    // en stuur het ook terug naar de aanroeper
    res.json(payload);
  } catch (err) {
    console.error("[suggest] error:", err);
    res.status(500).json({ error: "suggest_failed" });
  }
});

// GET /api/suggest/stream?conversation_id=...
router.get("/stream", (req, res) => {
  const { conversation_id } = req.query || {};
  if (!conversation_id) return res.status(400).send("conversation_id required");
  subscribe(conversation_id, res);
});

module.exports = router;
