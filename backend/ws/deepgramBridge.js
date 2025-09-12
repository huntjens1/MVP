// backend/ws/deepgramBridge.js
// WS Bridge: /ws/mic <-> Deepgram listen WS
const { WebSocketServer, WebSocket } = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');

const PATH = '/ws/mic';
const DG_WSS = 'wss://api.deepgram.com/v1/listen';
const DG_KEY = process.env.DEEPGRAM_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

function attach(server) {
  if (!server || typeof server.on !== 'function') {
    console.error('[ws] attach: invalid server');
    return;
  }

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname, query } = url.parse(req.url, true);
    if (pathname !== PATH) return;

    // Auth: kortlevende WS-token
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
    // Parameters voor Deepgram samenstellen
    const params = new url.URLSearchParams();

    // 1) Neem client parameters over waar relevant
    // Client stuurt 'codec=linear16'; Deepgram verwacht 'encoding=linear16'
    const codec = query.codec != null ? String(query.codec) : null;
    const encoding = query.encoding != null ? String(query.encoding) : (codec || null);

    const passParams = [
      'model', 'language', 'tier', 'smart_format', 'interim_results',
      'diarize', 'punctuate', 'numerals',
      // 'encoding', 'sample_rate', 'channels' zetten we hieronder met defaults
    ];
    for (const k of passParams) {
      if (query[k] != null) params.set(k, String(query[k]));
    }

    // 2) Veilige defaults forceren voor PCM16 stream
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

    // client -> deepgram (audio)
    client.on('message', (buf) => {
      if (dg.readyState === WebSocket.OPEN) {
        // backpressure guard
        if (dg.bufferedAmount > 1_000_000) return; // ~1MB buffer
        dg.send(buf);
        frames += 1;
        if (frames === 1) firstAudioAt = Date.now();
        // log alleen eerste paar frames om noise te beperken
        if (frames <= 3) {
          console.debug('[ws] audio frame -> dg', { size: buf?.length || 0, frames });
        }
      }
    });

    client.on('error', (err) => {
      console.error('[ws] client error', { err: err?.message });
      try { dg.close(); } catch {}
    });

    // deepgram -> client (transcripts / events)
    dg.on('message', (msg) => {
      try {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
      } catch (e) {
        console.error('[ws] send to client failed', { err: e?.message });
      }
    });

    dg.on('open', () => console.debug('[ws] deepgram open'));

    dg.on('close', (code, reason) => {
      console.debug('[ws] deepgram closed', {
        code, reason: reason?.toString(), frames, firstAudioMs: firstAudioAt ? (Date.now() - firstAudioAt) : null,
      });
      try { client.close(); } catch {}
    });

    dg.on('error', (err) => {
      console.error('[ws] deepgram error', { err: err?.message });
      try { client.close(1011, 'deepgram_error'); } catch {}
    });

    client.on('close', (code, reason) => {
      console.debug('[ws] client closed', { code, reason: reason?.toString(), frames });
      try { dg.close(); } catch {}
    });
  });

  console.debug('[ws] mic bridge attached', { path: PATH });
}

module.exports = { attach };
