import url from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

/**
 * WS Bridge naar Deepgram met dynamische codec:
 *   /ws/mic?conversation_id=...&token=...&codec=opus|linear16
 * - codec=opus     -> containerized (WebM/OGG/Opus): GEEN encoding/sample_rate in de URL
 * - codec=linear16 -> raw PCM: encoding=linear16&sample_rate=16000
 */
export function initMicBridge(server) {
  const wss = new WebSocketServer({ noServer: true });

  const hardReject = (socket, code, msg) => {
    try {
      socket.write(`HTTP/1.1 ${code} ${msg}\r\n\r\n`);
      socket.destroy();
    } catch {}
  };

  server.on('upgrade', (req, socket, head) => {
    const { pathname, searchParams } = new url.URL(req.url, `http://${req.headers.host}`);
    if (pathname !== '/ws/mic') return;

    // --- Auth
    const token = searchParams.get('token');
    if (!token) return hardReject(socket, 401, 'Unauthorized');
    try {
      jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return hardReject(socket, 401, 'Invalid token');
    }

    const conversationId = searchParams.get('conversation_id');
    if (!conversationId) return hardReject(socket, 400, 'Missing conversation_id');

    const dgKey = process.env.DEEPGRAM_API_KEY;
    if (!dgKey) return hardReject(socket, 500, 'DEEPGRAM_API_KEY missing');

    const codec = (searchParams.get('codec') || 'opus').toLowerCase();
    const isLinear = codec === 'linear16';

    // 🔑 Deepgram URL:
    // - Containerized (Opus/WebM/OGG): géén encoding/sample_rate parameters!
    // - Raw PCM (linear16): wél encoding + sample_rate
    const base =
      'wss://api.deepgram.com/v1/listen' +
      `?model=nova-3` +
      `&language=nl` +
      `&channels=1` +
      `&interim_results=true` +
      `&punctuate=true` +
      `&diarize=true` +
      `&smart_format=true`;

    const dgUrl = isLinear
      ? `${base}&encoding=linear16&sample_rate=16000`
      : base; // containerized Opus -> laat Deepgram zelf detecteren

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      const dgWs = new WebSocket(dgUrl, {
        headers: { Authorization: `Token ${dgKey}` },
      });

      const safeClose = (code = 1000, reason = '') => {
        try { clientWs.close(code, reason); } catch {}
        try { dgWs.close(code, reason); } catch {}
      };

      dgWs.on('open', () => {
        // client -> Deepgram
        clientWs.on('message', (data, isBinary) => {
          if (dgWs.readyState === WebSocket.OPEN) {
            dgWs.send(data, { binary: isBinary });
          }
        });
        clientWs.on('close', () => safeClose());

        // Deepgram -> client
        dgWs.on('message', (data) => {
          try { clientWs.send(data); } catch {}
        });
        dgWs.on('error', () => safeClose(1011, 'Deepgram error'));
        dgWs.on('close', () => safeClose());
      });

      clientWs.on('error', () => safeClose(1011, 'Client WS error'));
    });
  });
}
