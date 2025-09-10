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
    punctuate: 'true'
  });
  return `${base}?${params.toString()}`;
}

function connectDeepgram() {
  const url = deepgramUrl();
  const headers = { Authorization: `Token ${assertEnv('DEEPGRAM_API_KEY')}` };
  return new WebSocket(url, { headers });
}

/**
 * Create a dedicated WS server only for our path; keep Node’s HTTP server for Express.
 */
function attach(server /*, app */) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    try {
      const u = new URL(req.url, `http://${req.headers.host}`);
      if (u.pathname !== PATH) return; // ignore other upgrade paths

      // Optionally: auth check here (e.g., validate JWT from query/header)
      // if (!isValid(req)) { socket.destroy(); return; }

      wss.handleUpgrade(req, socket, head, (client) => {
        wss.emit('connection', client, req);
      });
    } catch (e) {
      socket.destroy();
    }
  });

  wss.on('connection', (client /*, req */) => {
    const dg = connectDeepgram();

    dg.on('open', () => {
      client.send(JSON.stringify({ type: 'deepgram_open' }));
    });

    dg.on('message', (msg) => {
      // Forward transcription events to the browser
      try {
        client.send(msg);
      } catch (_) {}
    });

    dg.on('close', () => {
      try { client.close(1000, 'deepgram_closed'); } catch (_) {}
    });

    dg.on('error', (err) => {
      try { client.close(1011, `deepgram_error:${err.message}`); } catch (_) {}
    });

    // From browser to Deepgram (PCM16 frames)
    client.on('message', (data, isBinary) => {
      if (dg.readyState === WebSocket.OPEN) {
        dg.send(data, { binary: isBinary });
      }
    });

    client.on('close', () => {
      try { dg.close(); } catch (_) {}
    });
  });

  console.log(`[ws] Deepgram mic bridge attached on ${PATH}`);
}

module.exports = { attach };
