// Production-grade WebSocket bridge: client <-> Deepgram
// Handshake: wss://<host>/ws/mic?conversation_id=...&token=...&codec=linear16|opus&sample_rate=16000
const { WebSocketServer, WebSocket } = require('ws');
const url = require('url');

function setupMicWs(server) {
  const wss = new WebSocketServer({ noServer: true });

  // Upgrade handshakes vanuit Node HTTP server
  server.on('upgrade', (req, socket, head) => {
    try {
      const { pathname } = new URL(req.url, `http://${req.headers.host}`);
      if (pathname !== '/ws/mic') {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (clientWs, req) => {
    const { query } = url.parse(req.url, true);
    const {
      token,
      codec = 'linear16',
      sample_rate = '16000',
      model = 'nova-2',
      smart_format = 'true',
      interim_results = 'true',
      punctuate = 'true',
      diarize = 'false',
      language = 'nl',
    } = query || {};

    // Auth: gebruik ephemeral token (query) of fallback naar env key
    const DG_TOKEN =
      (typeof token === 'string' && token) ||
      process.env.DEEPGRAM_API_KEY ||
      '';

    if (!DG_TOKEN) {
      try { clientWs.close(1011, 'deepgram_token_missing'); } catch {}
      return;
    }

    // Deepgram WS URL
    const dgUrl = new URL('wss://api.deepgram.com/v1/listen');
    dgUrl.searchParams.set('encoding', codec === 'opus' ? 'opus' : 'linear16');
    dgUrl.searchParams.set('sample_rate', String(sample_rate || '16000'));
    dgUrl.searchParams.set('model', model);
    dgUrl.searchParams.set('language', language);
    dgUrl.searchParams.set('smart_format', String(smart_format));
    dgUrl.searchParams.set('interim_results', String(interim_results));
    dgUrl.searchParams.set('punctuate', String(punctuate));
    dgUrl.searchParams.set('diarize', String(diarize));

    const dgWs = new WebSocket(dgUrl.toString(), {
      headers: { Authorization: `Token ${DG_TOKEN}` },
    });

    // PING keepalive om idle disconnects te voorkomen
    let pingIv = null;
    const startPinger = () => {
      if (pingIv) return;
      pingIv = setInterval(() => {
        try { if (clientWs.readyState === WebSocket.OPEN) clientWs.ping(); } catch {}
        try { if (dgWs.readyState === WebSocket.OPEN) dgWs.ping(); } catch {}
      }, 15000);
    };
    const stopPinger = () => { if (pingIv) clearInterval(pingIv); pingIv = null; };

    // Als Deepgram open is, begin doorzetten van audio
    dgWs.on('open', () => {
      startPinger();
      clientWs.on('message', (data) => {
        if (dgWs.readyState === WebSocket.OPEN) {
          dgWs.send(data, { binary: true });
        }
      });
    });

    // Antwoorden van Deepgram -> 1:1 naar client (frontend verwacht raw DG JSON)
    dgWs.on('message', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    });

    // Cleanup
    const cleanup = () => {
      stopPinger();
      try { dgWs.close(); } catch {}
      try { clientWs.close(); } catch {}
    };

    clientWs.on('close', cleanup);
    clientWs.on('error', cleanup);
    dgWs.on('close', cleanup);
    dgWs.on('error', cleanup);
  });
}

module.exports = { setupMicWs };
