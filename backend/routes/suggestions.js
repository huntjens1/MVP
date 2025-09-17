// backend/routes/suggestions.js
// GET /api/suggestions?conversation_id=...  (SSE)

const express = require("express");
const router = express.Router();
const { subscribe } = require("../streams/suggestionsSSE");

function sse(req, res) {
  const conversationId = String(req.query.conversation_id || "");
  if (!conversationId) return res.status(400).json({ error: "conversation_id_required" });

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // abonneren
  subscribe(conversationId, req, res);

  // meteen ping zodat client 'open' is
  try { res.write("event: ping\ndata: {}\n\n"); } catch {}
}

// beide paden ondersteunen
router.get("/api/suggestions", sse);
router.get("/suggestions", sse);

module.exports = router;
