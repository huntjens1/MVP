// backend/streams/assistSSE.js
// Eenvoudige SSE helper voor assist-achtige streams (debug-vriendelijk)

const DEBUG_ON = /^true|1|yes$/i.test(String(process.env.DEBUG || 'false'));
const debug = (...a) => { if (DEBUG_ON) console.log('[assistSSE]', ...a); };

function startAssistSSE(res, { conversation_id }) {
  try {
    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // proxies niet laten bufferen
    });
    res.flushHeaders?.();

    // Welkomst/ack
    res.write(`event: hello\n`);
    res.write(`data: ${JSON.stringify({ ok: true, conversation_id })}\n\n`);

    // Lege init batch
    res.write(`event: assist\ndata: ${JSON.stringify({ chunks: [] })}\n\n`);

    // Heartbeat
    const hb = setInterval(() => {
      try { res.write(`event: ping\ndata: {}\n\n`); } catch {}
    }, 20000);

    const close = () => {
      debug('SSE closed', { conversation_id });
      clearInterval(hb);
      try { res.end(); } catch {}
    };

    res.on('close', close);
    res.on('error', close);

    debug('SSE started', { conversation_id });
    return close;
  } catch (e) {
    debug('startAssistSSE error', e?.message);
    try { res.status(500).end(); } catch {}
    return () => {};
  }
}

module.exports = { startAssistSSE };
