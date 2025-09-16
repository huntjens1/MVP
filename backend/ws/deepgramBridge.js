// backend/ws/deepgramBridge.js
const { WebSocketServer } = require("ws");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const url = require("url");
const { buildKeywordList } = require("../utils/keywords");

const DG_API_KEY = process.env.DEEPGRAM_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const SILENCE_KEEPALIVE_MS = 10_000;

function attach(server, path = "/ws/mic") {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname, query } = url.parse(req.url, true);
    if (pathname !== path) return;

    try {
      const token = String(query.token || "");
      const payload = jwt.verify(token, JWT_SECRET);
      wss.handleUpgrade(req, socket, head, (wsClient) => {
        wss.emit("connection", wsClient, req, query, payload);
      });
    } catch (err) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });

  wss.on("connection", (wsClient, req, query, jwtPayload) => {
    const conversationId = String(query.conversation_id || "");
    const sampleRate = Number(query.sample_rate || 16000) || 16000;
    const language = String(query.language || "nl");
    const model = String(query.model || "nova-2");
    const smart = String(query.smart_format || "true");
    const interim = String(query.interim_results || "true");
    const diarize = String(query.diarize || "true");

    const agentEmail = jwtPayload?.agent?.email || null;
    const tenant = jwtPayload?.tenant || "default";

    // optionele aanvullingen vanuit query (?kw=a,b)
    const extraKw =
      typeof query.kw === "string"
        ? String(query.kw)
            .split(/[;,]/g)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const keywordsArr = buildKeywordList({ tenant, agentEmail, extra: extraKw });
    const keywords = keywordsArr.join(",");

    const params = new URLSearchParams({
      model,
      language,
      smart_format: smart,
      interim_results: interim,
      diarize,
      sample_rate: String(sampleRate),
    });
    if (keywords) params.set("keywords", keywords);

    const dgUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
    console.log("[ws] client connected", {
      path,
      convo: conversationId || null,
      tenant,
      agent: agentEmail || null,
      keywords_count: keywordsArr.length,
    });

    const wsDG = new WebSocket(dgUrl, {
      headers: { Authorization: `Token ${DG_API_KEY}` },
    });

    let lastAudioAt = Date.now();
    const silenceTimer = setInterval(() => {
      if (wsDG.readyState !== WebSocket.OPEN) return;
      const idle = Date.now() - lastAudioAt;
      if (idle >= SILENCE_KEEPALIVE_MS) {
        const samples = Math.round(0.1 * sampleRate);
        const silence = Buffer.alloc(samples * 2);
        try { wsDG.send(silence); } catch {}
      }
    }, 1000);

    wsDG.on("open", () => console.log("[ws] deepgram open"));
    wsDG.on("message", (data) => { try { wsClient.send(data); } catch {} });
    wsDG.on("close", (code, reason) => {
      console.log("[ws] deepgram closed", { code, reason: String(reason || "") });
      try { wsClient.close(1000); } catch {}
      clearInterval(silenceTimer);
    });
    wsDG.on("error", (err) => {
      console.log("[ws] deepgram error", { error: String(err) });
      try { wsClient.close(1011); } catch {}
      clearInterval(silenceTimer);
    });

    wsClient.on("message", (data) => {
      lastAudioAt = Date.now();
      try { wsDG.send(data); } catch {}
    });
    wsClient.on("close", (code, reason) => {
      console.log("[ws] client closed", { code, reason: String(reason || "") });
      try { wsDG.close(1000); } catch {}
      clearInterval(silenceTimer);
    });
    wsClient.on("error", (err) => {
      console.log("[ws] client error", { error: String(err) });
      try { wsDG.close(1011); } catch {}
      clearInterval(silenceTimer);
    });
  });

  console.log("[ws] mic bridge attached", { path });
}

module.exports = attach;
module.exports.attach = attach;
