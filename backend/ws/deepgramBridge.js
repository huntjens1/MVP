import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabaseClient.js';

export function initMicBridge(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname, query } = url.parse(request.url, true);
    if (pathname !== '/ws/mic') return;

    const { token, conversation_id } = query || {};
    if (!token || !conversation_id) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return;
    }

    let claims;
    try {
      claims = jwt.verify(token, process.env.WS_JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      handleClient(ws, { conversation_id, claims });
    });
  });
}

function handleClient(clientWs, { conversation_id, claims }) {
  // Connect naar Deepgram EU
  const qs = [
    'model=nova-3',
    'language=nl',
    'interim_results=true',
    'punctuate=true',
    'diarize=true'
  ].join('&');

  const dg = new WebSocket(`wss://eu.deepgram.com/v1/listen?${qs}`, {
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` }
  });

  dg.on('open', () => {
    // audio van browser -> deepgram
    clientWs.on('message', (data) => {
      if (dg.readyState === WebSocket.OPEN) dg.send(data);
    });
  });

  dg.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // stuur deepgram result terug naar browser voor UI
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(JSON.stringify(msg));

      const alt = msg?.channel?.alternatives?.[0];
      const text = alt?.transcript?.trim();
      const words = alt?.words || [];
      const speaker = (words.length > 0 && words[0].speaker !== undefined) ? words[0].speaker : null;

      // final stukjes opslaan
      if (msg.is_final && text) {
        await supabase.from('transcripts').insert({
          conversation_id,
          tenant_id: claims.tenant_id,
          content: text,
          is_final: true,
          speaker_label: speaker === 0 ? 'Agent' : (speaker === 1 ? 'Gebruiker' : null),
          speaker
        });
      }
    } catch { /* ignore parse errors */ }
  });

  const closeBoth = () => {
    try { clientWs.close(); } catch {}
    try { dg.close(); } catch {}
  };

  clientWs.on('close', closeBoth);
  dg.on('close', closeBoth);
  clientWs.on('error', closeBoth);
  dg.on('error', closeBoth);
}
