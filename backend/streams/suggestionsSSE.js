// backend/streams/suggestionsSSE.js
// Pub/Sub model voor suggestions via SSE (meerdere clients per conversation)

const clients = new Map(); // conversation_id -> Set<res>
const DEBUG_ON = /^true|1|yes$/i.test(String(process.env.DEBUG || 'false'));
const debug = (...a) => { if (DEBUG_ON) console.log('[suggestionsSSE]', ...a); };

function subscribe(conversationId, res) {
  if (!clients.has(conversationId)) clients.set(conversationId, new Set());
  clients.get(conversationId).add(res);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const count = clients.get(conversationId).size;
  debug('client subscribed', { conversationId, clients: count });

  // Heartbeat
  const hb = setInterval(() => {
    try { res.write(`event: ping\ndata: {}\n\n`); } catch {}
  }, 15000);

  res.on('close', () => {
    clearInterval(hb);
    const set = clients.get(conversationId);
    if (set) {
      set.delete(res);
      if (set.size === 0) clients.delete(conversationId);
    }
    debug('client closed', {
      conversationId,
      remaining: clients.get(conversationId)?.size || 0,
    });
  });
}

function emit(conversationId, payload) {
  const set = clients.get(conversationId);
  if (!set || set.size === 0) {
    debug('emit skipped, no clients', { conversationId });
    return;
  }
  const data = JSON.stringify(payload);
  for (const res of set) {
    try {
      res.write(`event: suggestions\ndata: ${data}\n\n`);
    } catch (e) {
      debug('emit write error', e?.message);
    }
  }
  debug('emit sent', { conversationId, receivers: set.size });
}

module.exports = { subscribe, emit };
