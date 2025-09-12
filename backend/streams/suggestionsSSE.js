// backend/streams/suggestionsSSE.js
'use strict';

const channels = new Map();   // conversation_id -> Set<res>
const userMap  = new Map();   // userId -> Set<conversationId>

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

  const userId = req.user?.id || req.user?.sub || null;
  if (userId) {
    let convs = userMap.get(userId);
    if (!convs) { convs = new Set(); userMap.set(userId, convs); }
    convs.add(conversationId);
  }

  const hb = setInterval(() => { try { res.write('event: ping\ndata: {}\n\n'); } catch {} }, 25_000);

  req.on('close', () => {
    clearInterval(hb);
    try { res.end(); } catch {}
    set.delete(res);
    if (set.size === 0) {
      channels.delete(conversationId);
      if (userId && userMap.has(userId)) {
        const convs = userMap.get(userId);
        convs.delete(conversationId);
        if (convs.size === 0) userMap.delete(userId);
      }
    }
  });

  return () => {
    clearInterval(hb);
    try { res.end(); } catch {}
    set.delete(res);
    if (set.size === 0) {
      channels.delete(conversationId);
      if (userId && userMap.has(userId)) {
        const convs = userMap.get(userId);
        convs.delete(conversationId);
        if (convs.size === 0) userMap.delete(userId);
      }
    }
  };
}

function writeBoth(res, payload, typeName) {
  const data = JSON.stringify(payload);
  res.write(`event: ${typeName}\ndata: ${data}\n\n`); // named
  res.write(`data: ${data}\n\n`);                      // default
}

function emit(conversationId, payload) {
  if (!conversationId) return;
  const set = channels.get(conversationId);
  if (!set || set.size === 0) return;
  let delivered = 0;
  for (const res of set) {
    try { writeBoth(res, payload, 'suggestions'); delivered++; } catch {}
  }
  if (delivered) {
    console.debug('[suggestionsSSE] delivered', { conversationId, delivered });
  }
}

function emitToUser(userId, payload) {
  if (!userId) return;
  const convs = userMap.get(userId);
  if (!convs || convs.size === 0) return;

  const targets = new Set();
  for (const convId of convs) {
    const set = channels.get(convId);
    if (!set) continue;
    for (const res of set) targets.add(res);
  }
  let delivered = 0;
  for (const res of targets) {
    try { writeBoth(res, payload, 'suggestions'); delivered++; } catch {}
  }
  if (delivered) {
    console.debug('[suggestionsSSE] deliveredToUser', { userId, delivered });
  }
}

module.exports = { subscribe, emit, emitToUser };
