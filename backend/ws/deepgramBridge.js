import url from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

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

    const token = searchParams.get('token');
    if (!token) return hardReject(socket, 401, 'Unauthorized');

    let claims;
    try {
      claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (e) {
      return hardReject(socket, 401, 'Invalid token');
    }

    const conversationId = searchParams.get('conversation_id');
    if (!conversationId) return hardReject(socket, 400, 'Missing conversation_id');

    const dgKey = process.env.DEEPGRAM_API_KEY;
    if (!dgKey) return hardReject(socket, 500, 'DEEPGRAM_API_KEY missing');

    // ✅ Opus @ 48kHz + NL + nova-3
    const dgUrl =
      'wss://api.deepgram.com/v1/listen' +
      '?model=nova-3' +
      '&language=nl' +
      '&encoding=opus' +
      '&sample_rate=48000' +
      '&channels=1' +
      '&interim_results=true' +
      '&punctuate=true' +
      '&diarize=true' +
      '&smart_format=true';

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      const dgWs = new WebSocket(dgUrl, {
        headers: { Authorization: `Token ${dgKey}` },
      });

      const safeClose = (code = 1000, reason = '') => {
        try { clientWs.close(code, reason); } catch {}
        try { dgWs.close(code, reason); } catch {}
      };

      dgWs.on('open', () => {
        // client -> deepgram (binaire opus-chunks)
        clientWs.on('message', (data, isBinary) => {
          if (dgWs.readyState === WebSocket.OPEN) dgWs.send(data, { binary: isBinary });
        });

        clientWs.on('close', () => safeClose());

        // deepgram -> client (json events)
        dgWs.on('message', (data) => {
          try { clientWs.send(data); } catch {}
        });

        dgWs.on('error', (err) => {
          try { clientWs.send(JSON.stringify({ type: 'error', message: 'deepgram_error' })); } catch {}
          safeClose(1011, 'Deepgram error');
        });

        dgWs.on('close', () => safeClose());
      });

      clientWs.on('error', () => safeClose(1011, 'Client WS error'));
    });
  });
}
