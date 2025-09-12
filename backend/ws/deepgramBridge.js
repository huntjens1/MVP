// backend/ws/deepgramBridge.js
// WS Bridge: /ws/mic <-> Deepgram listen WS
'use strict';
const { WebSocketServer, WebSocket } = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');

const PATH = '/ws/mic';
const DG_WSS = 'wss://api.deepgram.com/v1/listen';
const DG_KEY = process.env.DEEPGRAM_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

// Heartbeat config
const CLIENT_PING_MS = 25_000;
const IDLE_TIMEOUT_MS = 90_000;

function attach(server) {
  if (!server || typeof server.on !== 'function') {
    console.error('[ws] attach: invalid server');
    return;
  }

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname, query } = url.parse(req.url, true);
    if (pathname !== PATH) return;

    const token = String(query.token || '');
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = {
        sub: payload.sub,
        conversation_id: payload.conversation_id || null,
      };
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (client) => {
      wss.emit('connection', client, req, query);
    });
  });

  wss.on('connection', (client, req, query) => {
    // Assemble Deepgram params
    const params = new url.URLSearchParams();

    const codec = query.codec != null ? String(query.codec) : null;
    const encoding = query.encoding != null ? String(query.encoding) : (codec || null);

    const passParams = [
      'model', 'language', 'tier', 'smart_format', 'interim_results',
      'diarize', 'punctuate', 'numerals',
    ];
    for (const k of passParams) {
      if (query[k] != null) params.set(k, String(query[k]));
    }

    // Safe defaults
    params.set('encoding', encoding || 'linear16');
    params.set('sample_rate', String(query.sample_rate != null ? query.sample_rate : 16000));
    params.set('channels', String(query.channels != null ? query.channels : 1));
    if (!params.has('smart_format')) params.set('smart_format', 'true');
    if (!params.has('interim_results')) params.set('interim_results', 'true');

    if (!DG_KEY) {
      client.close(1011, 'Deepgram key missing');
      return;
    }

    const dgUrl = `${DG_WSS}?${params.toString()}`;
    const dg = new WebSocket(dgUrl, {
      headers: { Authorization: `Token ${DG_KEY}` },
    });

    console.debug('[ws] client connected', {
      path: req.url,
      convo: req.user?.conversation_id || null,
      dgUrl,
    });

    let frames = 0;
    let firstAudioAt = 0;
    let lastActivity = Date.now();

    // Heartbeat / idle guard
    let hbInt = setInterval(() => {
      try {
        if (client.readyState === WebSocket.OPEN) client.ping();
      } catch {}
      // Idle timeout (geen audio/activiteit)
      if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
        try { client.close(1000, 'idle_timeout'); } catch {}
        try { dg.close(1000, 'idle_timeout'); } catch {}
      }
    }, CLIENT_PING_MS);

    client.on('pong', () => { /* noop, maar reset evt. idle timers hier als je wilt */ });

    // client -> deepgram (audio)
    client.on('message', (buf) => {
      lastActivity = Date.now();
      if (dg.readyState === WebSocket.OPEN) {
        if (dg.bufferedAmount > 1_000_000) return; // backpressure
        dg.send(buf);
        frames += 1;
        if (frames === 1) firstAudioAt = Date.now();
        if (frames <= 3) {
          console.debug('[ws] audio frame -> dg', { size: buf?.length || 0, frames });
        }
      }
    });

    client.on('error', (err) => {
      console.error('[ws] client error', { err: err?.message });
      try { dg.close(1011, 'client_error'); } catch {}
    });

    // deepgram -> client
    dg.on('message', (msg) => {
      try {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
      } catch (e) {
        console.error('[ws] send to client failed', { err: e?.message });
      }
    });

    dg.on('open', () => console.debug('[ws] deepgram open'));

    dg.on('close', (code, reason) => {
      const rc = code === 1005 ? 'no_status' : code;
      console.debug('[ws] deepgram closed', {
        code: rc, reason: reason?.toString(), frames, firstAudioMs: firstAudioAt ? (Date.now() - firstAudioAt) : null,
      });
      try { client.close(1000, 'dg_closed'); } catch {}
      clearInterval(hbInt);
    });

    dg.on('error', (err) => {
      console.error('[ws] deepgram error', { err: err?.message });
      try { client.close(1011, 'deepgram_error'); } catch {}
      clearInterval(hbInt);
    });

    client.on('close', (code, reason) => {
      const rc = code === 1005 ? 'no_status' : code;
      console.debug('[ws] client closed', { code: rc, reason: reason?.toString(), frames });
      try { dg.close(1000, 'client_closed'); } catch {}
      clearInterval(hbInt);
    });
  });

  console.debug('[ws] mic bridge attached', { path: PATH });
}

module.exports = { attach };
