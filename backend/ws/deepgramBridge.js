import url from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

/**
 * WebSocket bridge: browser mic -> server -> Deepgram ASR
 * - Auth: short-lived JWT in query (?token=...)
 * - Path: /ws/mic?conversation_id=...&token=...
 */
export function initMicBridge(server) {
  const wss = new WebSocketServer({ noServer: true });

  // --- helpers
  const reject = (res, code, msg) => {
    res.writeHead(code, { 'content-type': 'text/plain' });
    res.end(msg);
  };

  server.on('upgrade', async (req, socket, head) => {
    try {
      const { pathname, searchParams } = new url.URL(req.url, `http://${req.headers.host}`);
      if (pathname !== '/ws/mic') return; // not our WS; let other handlers run

      // 1) Auth via short-lived JWT in query
      const token = searchParams.get('token');
      if (!token) return reject(socket, 401, 'Missing token');

      let claims;
      try {
        claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      } catch (e) {
        return reject(socket, 401, `Invalid token: ${e?.message || 'jwt error'}`);
      }

      // 2) Required params
      const conversationId = searchParams.get('conversation_id');
      if (!conversationId) return reject(socket, 400, 'Missing conversation_id');

      // 3) Deepgram WS init
      const dgKey = process.env.DEEPGRAM_API_KEY;
      if (!dgKey) return reject(socket, 500, 'DEEPGRAM_API_KEY missing');

      // NB: model/params NL
      const dgUrl = 'wss://api.deepgram.com/v1/listen?model=nova-3&language=nl&sample_rate=16000&interim_results=true&punctuate=true&diarize=true';

      // Complete HTTP upgrade for browser <-> server
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        // Open upstream Deepgram socket
        const dgWs = new WebSocket(dgUrl, {
          headers: { Authorization: `Token ${dgKey}` },
        });

        const safeClose = (code = 1000, reason = '') => {
          try { clientWs.close(code, reason); } catch {}
          try { dgWs.close(code, reason); } catch {}
        };

        // When Deepgram opens, we can start piping mic frames
        dgWs.on('open', () => {
          // bridge audio from client -> Deepgram
          clientWs.on('message', (data, isBinary) => {
            if (dgWs.readyState === WebSocket.OPEN) {
              dgWs.send(data, { binary: isBinary });
            }
          });

          // if client closes, close upstream
          clientWs.on('close', () => safeClose());

          // forward Deepgram transcripts back to client (optional UI)
          dgWs.on('message', (data) => {
            try {
              clientWs.send(data);
            } catch {}
          });

          dgWs.on('close', () => safeClose());
          dgWs.on('error', () => safeClose(1011, 'Deepgram error'));
        });

        clientWs.on('error', () => safeClose(1011, 'Client WS error'));
      });
    } catch (e) {
      // hard reject on unexpected errors
      try {
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      } catch {}
    }
  });
}
