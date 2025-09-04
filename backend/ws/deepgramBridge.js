// Deepgram mic bridge: client PCM/Opus -> Deepgram WS
const { WebSocketServer, WebSocket } = require('ws');
const url = require('url');

function setupMicWs(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let pathname;
    try {
      pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== '/ws/mic') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
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

    const DG_TOKEN =
      (typeof token === 'string' && token) ||
      process.env.DEEPGRAM_API_KEY ||
      '';

    if (!DG_TOKEN) {
      try { clientWs.close(1011, 'deepgram_token_missing'); } catch {}
      return;
    }

    const dgUrl = new URL('wss://api.deepgram.com/v1/listen');
    dgUrl.searchParams.set('encoding', codec === 'opus' ? 'opus' : 'linear16');
    dgUrl.searchParams.set('sample_rate', String(sample_rate || '16000'));
    dgUrl.searchParams.set('model', model);
    dgUrl.searchParams.set('language', language);
    dgUrl.searchParams.set('smart_format', String(smart_format));
    dgUrl.searchParams.set('interim_results', String(interim_results));
    dgUrl.searchParams.set('punctuate', String(punctuate));
    dgUrl.searchParams.set('diarize', String(diarize));

    // Maak Deepgram WS
    const dgWs = new WebSocket(dgUrl.toString(), {
      headers: { Authorization: `Token ${DG_TOKEN}` },
    });

    // Buffer audioframes tot DG open is (voorkomt verlies van vroege frames)
    const queue = [];
    let openDG = false;

    const flushQueue = () => {
      if (!openDG) return;
      while (queue.length) {
        const chunk = queue.shift();
        try { dgWs.send(chunk, { binary: true }); } catch {}
      }
    };

    // Keepalive
    let pingIv = null;
    const startPinger = () => {
      if (pingIv) return;
      pingIv = setInterval(() => {
        try { if (clientWs.readyState === WebSocket.OPEN) clientWs.ping(); } catch {}
        try { if (dgWs.readyState === WebSocket.OPEN) dgWs.ping(); } catch {}
      }, 15000);
    };
    const stopPinger = () => { if (pingIv) clearInterval(pingIv); pingIv = null; };

    // Client->DG: voeg handler meteen toe en buffer indien nodig
    clientWs.on('message', (data) => {
      if (openDG && dgWs.readyState === WebSocket.OPEN) {
        try { dgWs.send(data, { binary: true }); } catch {}
      } else {
        queue.push(data);
      }
    });

    // DG open: flush buffer
    dgWs.on('open', () => {
      openDG = true;
      startPinger();
      flushQueue();
    });

    // DG -> Client (JSON text)
    dgWs.on('message', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        try { clientWs.send(data); } catch {}
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
