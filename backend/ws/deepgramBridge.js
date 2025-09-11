// backend/ws/deepgramBridge.js
/**
 * Minimal WS upgrade hook for mic streaming.
 * - Attaches to Node http.Server
 * - Accepts upgrades on path `/ws/mic`
 * - Opens a WS to Deepgram and pipes frames back/forth
 *
 * Assumes you already mint a Deepgram URL + token on the server side.
 * If you’re doing that elsewhere, adapt connectDeepgram() accordingly.
 */

const { WebSocketServer, WebSocket } = require('ws');
const { URL } = require('url');

const PATH = '/ws/mic';

function dbg(...args) {
  // Zorg dat we ALTIJD debug prints hebben
  console.log('[ws]', ...args);
}

function assertEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function deepgramUrl() {
  // Streaming endpoint; tune query as needed (nova-2, interim, diarize, etc)
  // Docs: https://developers.deepgram.com
  const base = 'wss://api.deepgram.com/v1/listen';
  const params = new URLSearchParams({
    model: 'nova-2',
    language: 'nl',
    encoding: 'linear16',
    sample_rate: '16000',
    interim_results: 'true',
    diarize: 'true',
    smart_format: 'true',
    punctuate: 'true',
  });
  return `${base}?${params.toString()}`;
}

function connectDeepgram() {
  const url = deepgramUrl();
  const headers = { Authorization: `Token ${assertEnv('DEEPGRAM_API_KEY')}` };
  dbg('connecting to Deepgram', { url });
  return new WebSocket(url, { headers });
}

/**
 * Create a dedicated WS server only for our path; keep Node’s HTTP server for Express.
 */
function attach(server /* , app */) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    // Extra defensieve logging zodat we weten waarom iets faalt
    try {
      const hasUpgrade =
        typeof req.headers.upgrade === 'string' &&
        req.headers.upgrade.toLowerCase() === 'websocket';
      const u = new URL(req.url, `http://${req.headers.host}`);
      dbg('upgrade received', {
        method: req.method,
        url: req.url,
        path: u.pathname,
        hasUpgrade,
      });

      // Alleen deze route accepteren
      if (!hasUpgrade || u.pathname !== PATH) {
        return; // andere upgrades/requests negeren; Express kan hiermee verder
      }

      wss.handleUpgrade(req, socket, head, (client) => {
        wss.emit('connection', client, req);
      });
    } catch (e) {
      dbg('upgrade error', { error: e && e.message });
      try { socket.destroy(); } catch (_) {}
    }
  });

  wss.on('connection', (client, req) => {
    const u = new URL(req.url, `http://${req.headers.host}`);
    const q = Object.fromEntries(u.searchParams.entries());
    dbg('client connected', { path: u.pathname, query: q });

    // (optioneel) auth-check op q.token / cookies / headers
    // if (!isValid(q.token)) { client.close(1008, 'unauthorized'); return; }

    const dg = connectDeepgram();

    dg.on('open', () => {
      dbg('deepgram open');
      try { client.send(JSON.stringify({ type: 'deepgram_open' })); } catch (_) {}
    });

    dg.on('message', (msg) => {
      // Forward de transcript events naar de browser
      try { client.send(msg); } catch (e) { dbg('send to client failed', { err: e.message }); }
    });

    dg.on('close', (code, reason) => {
      dbg('deepgram closed', { code, reason: reason?.toString() });
      try { client.close(1000, 'deepgram_closed'); } catch (_) {}
    });

    dg.on('error', (err) => {
      dbg('deepgram error', { error: err && err.message });
      try { client.close(1011, `deepgram_error:${err.message}`); } catch (_) {}
    });

    // Frames van browser -> Deepgram (PCM16)
    client.on('message', (data, isBinary) => {
      if (dg.readyState === WebSocket.OPEN) {
        try { dg.send(data, { binary: isBinary }); } catch (e) { dbg('send to deepgram failed', { err: e.message }); }
      }
    });

    client.on('close', (code, reason) => {
      dbg('client closed', { code, reason: reason?.toString() });
      try { dg.close(); } catch (_) {}
    });

    client.on('error', (err) => {
      dbg('client error', { error: err && err.message });
      try { dg.close(); } catch (_) {}
    });
  });

  dbg(`Deepgram mic bridge attached on ${PATH}`);
}

// Backwards compatibility met eerdere naam in jouw index/app:
module.exports = {
  attach,
  attachDeepgramMicBridge: attach,
};
