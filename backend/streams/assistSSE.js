'use strict';

// backend/streams/assistSSE.js
const channels = new Map(); // conversation_id -> Set<res>

function subscribe(conversationId, req, res) {
  if (!conversationId) {
    res.status(400).json({ error: 'missing_conversation_id' });
    return () => {};
  }
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let set = channels.get(conversationId);
  if (!set) { set = new Set(); channels.set(conversationId, set); }
  set.add(res);

  const hb = setInterval(() => { try { res.write('event: ping\ndata: {}\n\n'); } catch {} }, 25_000);

  req.on('close', () => {
    clearInterval(hb);
    set.delete(res);
    if (set.size === 0) channels.delete(conversationId);
    try { res.end(); } catch {}
  });

  return () => {
    clearInterval(hb);
    set.delete(res);
    if (set.size === 0) channels.delete(conversationId);
    try { res.end(); } catch {}
  };
}

function emit(conversationId, payload) {
  const set = channels.get(conversationId);
  if (!set || set.size === 0) return;
  const data = JSON.stringify(payload);
  for (const res of set) {
    try { res.write(`event: assist\ndata: ${data}\n\n`); } catch {}
  }
}

module.exports = { subscribe, emit };
