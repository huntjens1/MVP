import url from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

/**
 * /ws/mic?conversation_id=...&token=...&codec=opus|linear16
 * - opus (WebM/OGG/Opus container): GEEN encoding/sample_rate in DG-URL (DG leest header)
 * - linear16 (raw PCM 16kHz): WEL encoding + sample_rate
 */
export function initMicBridge(server) {
  const wss = new WebSocketServer({ noServer: true });

  const hardReject = (socket, code, msg) => {
    try { socket.write(`HTTP/1.1 ${code} ${msg}\r\n\r\n`); socket.destroy(); } catch {}
  };

  server.on('upgrade', (req, socket, head) => {
    const { pathname, searchParams } = new url.URL(req.url, `http://${req.headers.host}`);
    if (pathname !== '/ws/mic') return;

    const token = searchParams.get('token');
    if (!token) return hardReject(socket, 401, 'Unauthorized');
    try { jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
    catch { return hardReject(socket, 401, 'Invalid token'); }

    const conversationId = searchParams.get('conversation_id');
    if (!conversationId) return hardReject(socket, 400, 'Missing conversation_id');

    const dgKey = process.env.DEEPGRAM_API_KEY;
    if (!dgKey) return hardReject(socket, 500, 'DEEPGRAM_API_KEY missing');

    const codec = (searchParams.get('codec') || 'opus').toLowerCase();
    const isLinear = codec === 'linear16';

    const base =
      'wss://api.deepgram.com/v1/listen' +
      `?model=nova-3&language=nl&channels=1` +
      `&interim_results=true&punctuate=true&diarize=true&smart_format=true`;

    // Containerized Opus -> geen encoding/sample_rate; PCM -> wel
    const dgUrl = isLinear ? `${base}&encoding=linear16&sample_rate=16000` : base;

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      // Zorg dat Deepgram JSON als text terugkomt (per-message deflate onderhandelen)
      const dgWs = new WebSocket(dgUrl, {
        headers: { Authorization: `Token ${dgKey}` },
        perMessageDeflate: true,
      });

      const safeClose = (code = 1000, reason = '') => {
        try { clientWs.close(code, reason); } catch {}
        try { dgWs.close(code, reason); } catch {}
      };

      dgWs.on('open', () => {
        // client -> Deepgram: binaire audio
        clientWs.on('message', (data, isBinary) => {
          if (dgWs.readyState === WebSocket.OPEN) dgWs.send(data, { binary: isBinary });
        });
        clientWs.on('close', () => safeClose());

        // Deepgram -> client: ALTIJD als tekstframe (UTF-8 JSON) terugsturen
        dgWs.on('message', (data, isBinary) => {
          try {
            let text;
            if (isBinary) {
              if (Buffer.isBuffer(data)) text = data.toString('utf8');
              else if (data instanceof ArrayBuffer) text = Buffer.from(data).toString('utf8');
              else text = String(data);
            } else {
              text = String(data);
            }
            clientWs.send(text); // text frame naar browser
          } catch {
            // laatste redmiddel: raw doorzetten
            try { clientWs.send(data, { binary: isBinary }); } catch {}
          }
        });

        dgWs.on('error', () => safeClose(1011, 'Deepgram error'));
        dgWs.on('close', () => safeClose());
      });

      clientWs.on('error', () => safeClose(1011, 'Client WS error'));
    });
  });
}
