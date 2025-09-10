/**
 * Eenvoudige SSE helper voor assist stream.
 * Vervang de TODO-blokken door je echte suggestie-logic of event bus.
 */
function startAssistSSE(res, { conversation_id }) {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();

  // Welkomst event
  res.write(`event: hello\n`);
  res.write(`data: ${JSON.stringify({ ok: true, conversation_id })}\n\n`);

  // Init-batch (leeg)
  res.write(`event: suggestion\ndata: ${JSON.stringify({ suggestions: [] })}\n\n`);

  // Heartbeat
  const hb = setInterval(() => {
    try { res.write(`event: ping\ndata: {}\n\n`); } catch {}
  }, 20000);

  // Sluiten
  const close = () => clearInterval(hb);
  res.on('close', close);
  res.on('error', close);

  return close;
}

module.exports = { startAssistSSE };
