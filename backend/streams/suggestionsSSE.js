// backend/streams/suggestionsSSE.js
const clients = new Map(); // conversation_id -> Set<res>

function subscribe(conversationId, res) {
  if (!clients.has(conversationId)) clients.set(conversationId, new Set());
  clients.get(conversationId).add(res);

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Edge/proxy vriendelijk
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  // Heartbeat
  const hb = setInterval(() => {
    try { res.write(`event: ping\ndata: {}\n\n`); } catch {}
  }, 15000);

  res.on("close", () => {
    clearInterval(hb);
    const set = clients.get(conversationId);
    if (set) {
      set.delete(res);
      if (set.size === 0) clients.delete(conversationId);
    }
  });
}

function emit(conversationId, payload) {
  const set = clients.get(conversationId);
  if (!set || set.size === 0) return;
  const data = JSON.stringify(payload);
  for (const res of set) {
    try { res.write(`event: suggestions\ndata: ${data}\n\n`); } catch {}
  }
}

module.exports = { subscribe, emit };
