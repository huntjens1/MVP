'use strict';

/**
 * Eenvoudige SSE-bus per conversation_id.
 * API:
 *  - sseSubscribe(conversationId, res, req?): registreert client & zet juiste headers
 *  - sseBroadcast(conversationId, event, data): push naar alle clients op kanaal
 *  - sseClose(conversationId): sluit alle clients (optioneel)
 *  - sseCount(conversationId): aantal open clients
 */

const channels = new Map(); // conversationId -> Set<res>

function ensureChannel(conversationId) {
  if (!channels.has(conversationId)) channels.set(conversationId, new Set());
  return channels.get(conversationId);
}

/**
 * Schrijf 1 SSE bericht.
 */
function writeSSE(res, { event, data }) {
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data ?? {})}\n\n`);
}

/**
 * Abonneer response op een SSE-kanaal.
 * Zorgt voor headers, keepalive, en verwijdert netjes bij 'close'.
 */
function sseSubscribe(conversationId, res, req) {
  if (!conversationId) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'conversation_id is required' }));
    return;
  }

  const ch = ensureChannel(conversationId);

  // Productie-headers voor SSE
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Laat proxies weten dat dit langdurige response is
  res.flushHeaders?.();

  const clientInfo = {
    conversationId,
    ua: req?.headers?.['user-agent'],
    ip: req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress,
  };

  ch.add(res);
  console.log('[assistSSE] client subscribed', {
    conversationId,
    clients: ch.size,
    ip: clientInfo.ip,
  });

  // Welkomst-/init event zodat de browser meteen 'open' detecteert
  writeSSE(res, { event: 'open', data: { ok: true, conversationId } });

  // Heartbeat (comment) om proxies/sockets warm te houden
  const heartbeat = setInterval(() => {
    // comment-line is geldig SSE, voorkomt timeouts
    try {
      res.write(`: hb ${Date.now()}\n\n`);
    } catch (e) {
      // schrijven faalde -> laat 'close' afhandeling doen
      clearInterval(heartbeat);
      safeCleanup();
    }
  }, 25_000);

  // Op socket errors/go-away netjes opruimen
  const safeCleanup = () => {
    clearInterval(heartbeat);
    if (ch.has(res)) {
      ch.delete(res);
      console.log('[assistSSE] client closed', {
        conversationId,
        remaining: ch.size,
      });
    }
    // response mag hier open blijven voor andere listeners; wij sluiten hem
    try { res.end(); } catch {}
  };

  res.on('close', safeCleanup);
  res.on('error', (err) => {
    console.warn('[assistSSE] client error', { conversationId, err: err?.message || err });
    safeCleanup();
  });
}

/**
 * Broadcast helper: stuur data/event naar alle subscribers op het kanaal.
 */
function sseBroadcast(conversationId, event, data) {
  const ch = channels.get(conversationId);
  if (!ch || ch.size === 0) return 0;

  let sent = 0;
  for (const res of [...ch]) {
    try {
      writeSSE(res, { event, data });
      sent++;
    } catch (err) {
      // als schrijven faalt, opruimen
      try { res.end(); } catch {}
      ch.delete(res);
      console.warn('[assistSSE] write failed, cleaned up', {
        conversationId,
        err: err?.message || err,
      });
    }
  }
  return sent;
}

/**
 * Sluit alle clients op kanaal (optioneel te gebruiken bij einde gesprek).
 */
function sseClose(conversationId) {
  const ch = channels.get(conversationId);
  if (!ch) return 0;
  for (const res of ch) {
    try { writeSSE(res, { event: 'end', data: { reason: 'server_close' } }); } catch {}
    try { res.end(); } catch {}
  }
  channels.delete(conversationId);
  return 0;
}

/**
 * Aantal open clients voor debug/metrics.
 */
function sseCount(conversationId) {
  return channels.get(conversationId)?.size || 0;
}

module.exports = {
  sseSubscribe,   // <- dit is waar je route op rekent
  sseBroadcast,
  sseClose,
  sseCount,
};
