// backend/routes/suggestions.js
// POST /api/suggest  +  SSE broadcast naar suggestionsSSE
// Behouwt bestaande werking, maar sanitisert LLM-output stevig en garandeert min. 3 vragen.

const express = require("express");
const router = express.Router();
const { publish: pushSuggestions } = require("../streams/suggestionsSSE");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.ASSIST_MODEL || process.env.SUMMARY_MODEL || "gpt-4o-mini";

// --- helpers ---
function cleanText(s) {
  if (!s) return "";
  let t = String(s).trim();

  // verwijder JSON/structuur die soms door LLM’s aan het eind geplakt wordt
  // bv. `... ? { "itil": { "type": "Service Request" }, "priority": 50 }`
  t = t.replace(/\s*[{[].*[\]}]\s*$/s, "");

  // verwijder opsommingstekens/nummering
  t = t.replace(/^\s*[-*•\d\)\.]+\s*/g, "");

  // dubbelspaties -> 1
  t = t.replace(/\s+/g, " ").trim();

  // alleen een vraagzin overhouden
  if (!/[?.!]$/.test(t)) t += "";
  return t;
}

function normalizeArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(cleanText).filter(Boolean);

  // JSON array? -> parse
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) return parsed.map(cleanText).filter(Boolean);
  } catch {}

  // anders: regels/punten
  return String(raw)
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*[-*•\d\)\.]+\s*/, ""))
    .map(cleanText)
    .filter(Boolean);
}

function fallbackQuestions(ctx) {
  const out = [];
  const lc = (ctx || "").toLowerCase();
  if (lc.includes("inlog")) out.push("Krijgt u een foutmelding bij het inloggen? Zo ja, welke exacte melding?");
  if (lc.includes("netwerk")) out.push("Werkt het op een ander netwerk of via hotspot? Kunt u een ping/gateway-test proberen?");
  if (lc.includes("mail") || lc.includes("email")) out.push("Gaat het om de e-mailclient of webmail? En welke omgeving/account?");
  out.push("Sinds wanneer speelt dit en is er kort ervoor iets gewijzigd (update/wijziging)?");
  out.push("Op hoeveel gebruikers/locaties treedt dit op (impact)?");
  out.push("Welke stappen zijn al geprobeerd en met welk resultaat?");
  return Array.from(new Set(out));
}

router.post("/api/suggest", async (req, res) => {
  const t0 = Date.now();
  try {
    const user = req.user?.email || null;
    const { conversation_id, transcript } = req.body || {};

    if (!conversation_id) return res.status(400).json({ error: "conversation_id is required" });

    // --- Roep LLM aan (kort & cheap) ---
    let suggestions = [];
    try {
      const system = [
        "Je bent een NL servicedesk-assistent (ITIL v4).",
        "Geef ALLEEN een lijst van KORTE vragen die de agent aan de klant kan stellen.",
        "Geen JSON, geen metadata, geen extra toelichting; uitsluitend vragen in duidelijke taal.",
        "3–6 items maximaal."
      ].join(" ");

      const prompt = `Context (laatste segmenten):
"""${(transcript || "").slice(0, 1200)}"""
Geef 3–6 KORTE vragen (één per regel).`;

      const r = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      });

      const raw = r.choices?.[0]?.message?.content || "";
      suggestions = normalizeArray(raw);
    } catch (err) {
      console.log("[suggestions] openai error", { error: String(err) });
    }

    // garandeer minimaal 3
    if (suggestions.length < 3) {
      suggestions = Array.from(new Set([...suggestions, ...fallbackQuestions(transcript)])).slice(0, 6);
    }

    // broadcast SSE
    pushSuggestions(conversation_id, {
      conversation_id,
      suggestions,
    });

    console.log("[suggestions] generated", {
      conversation_id,
      count: suggestions.length,
      user,
      ms: Date.now() - t0,
    });

    return res.json({ suggestions });
  } catch (err) {
    console.log("[suggestions] error", { error: String(err) });
    return res.status(500).json({ error: "suggestions_failed" });
  }
});

module.exports = router;
