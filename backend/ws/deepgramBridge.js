const WebSocket = require("ws");
const url = require("url");

const DG_WS = "wss://api.deepgram.com/v1/listen";

// Alleen realtime-compatibele query params toestaan
const PASS_KEYS = [
  "model",
  "language",
  "encoding",      // linear16
  "sample_rate",   // 16000
  "smart_format",  // true
  "interim_results",
  "diarize",
  // evt. veilig toevoegen: "keywords","search","filler_words","profanity_filter"
];

function buildDGUrl(q) {
  const u = new URL(DG_WS);

  // mapping: 'codec' -> 'encoding'
  if (q.codec && !q.encoding) u.searchParams.set("encoding", String(q.codec));
  if (q.sample_rate) u.searchParams.set("sample_rate", String(q.sample_rate));

  for (const k of PASS_KEYS) {
    const v = q[k];
    if (v !== undefined && v !== null && String(v).length) {
      u.searchParams.set(k, String(v));
    }
  }

  // Defaults afdwingen (nova-2, NL, 16k linear16)
  if (!u.searchParams.get("model")) u.searchParams.set("model", "nova-2");
  if (!u.searchParams.get("language")) u.searchParams.set("language", "nl");
  if (!u.searchParams.get("encoding")) u.searchParams.set("encoding", "linear16");
  if (!u.searchParams.get("sample_rate")) u.searchParams.set("sample_rate", "16000");
  if (!u.searchParams.get("smart_format")) u.searchParams.set("smart_format", "true");
  if (!u.searchParams.get("interim_results")) u.searchParams.set("interim_results", "true");

  return u.toString();
}

function setupMicWs(server, app, logger = console) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = url.parse(req.url);
    if (pathname !== "/ws/mic") return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (clientWs, req) => {
    const parsed = url.parse(req.url, true);
    const q = parsed.query || {};
    const tenantId = req.headers["x-tenant-id"] || "unknown";
    const rid = q.conversation_id || "rid-" + Math.random().toString(36).slice(2);

    // 1) Auth: prefer server-side permanente key; anders fallback naar query token
    const serverKey = process.env.DEEPGRAM_API_KEY && String(process.env.DEEPGRAM_API_KEY).trim();
    const queryToken = q.token && String(q.token).trim();
    const authToken = serverKey || queryToken;

    if (!authToken) {
      logger.error(`[DG] rid=${rid} no_auth_token (set DEEPGRAM_API_KEY or pass token=)`);
      try { clientWs.close(1008, "missing_auth"); } catch {}
      return;
    }

    const dgUrl = buildDGUrl(q);
    logger.info(`[DG] open rid=${rid} tenant=${tenantId} auth=${serverKey ? "SERVER_KEY" : "EPHEMERAL"} url=${dgUrl}`);

    const dgWs = new WebSocket(dgUrl, {
      headers: {
        Authorization: `Token ${authToken}`,
        "User-Agent": "CallLogix/1.0",
      },
    });

    // Log 4xx/5xx reden + body
    dgWs.on("unexpected-response", (request, response) => {
      let body = "";
      response.on("data", (chunk) => (body += chunk.toString()));
      response.on("end", () => {
        logger.error(
          `[DG400] rid=${rid} status=${response.statusCode} headers=${JSON.stringify(
            response.headers
          )} body=${body}`
        );
        try {
          clientWs.send(JSON.stringify({
            type: "error",
            source: "deepgram_handshake",
            status: response.statusCode,
            body,
          }));
        } catch {}
        try { clientWs.close(1011, "dg_unexpected_response"); } catch {}
      });
    });

    let dgOpen = false;
    const queue = [];
    let closed = false;

    const safeClose = (code = 1000, reason = "") => {
      if (closed) return;
      closed = true;
      try { clientWs.close(code, reason); } catch {}
      try { dgWs.close(code, reason); } catch {}
    };

    dgWs.on("open", () => {
      dgOpen = true;
      logger.info(`[DG] connected rid=${rid}`);
      for (const part of queue) { try { dgWs.send(part); } catch {} }
      queue.length = 0;
    });

    dgWs.on("message", (data) => {
      try { clientWs.send(data); } catch {}
    });

    dgWs.on("error", (err) => {
      logger.error(`[DG] error rid=${rid} ${err?.message || err}`);
      try {
        clientWs.send(JSON.stringify({ type: "error", source: "deepgram", message: String(err?.message || err) }));
      } catch {}
    });

    dgWs.on("close", (code, reason) => {
      logger.warn(`[DG] closed rid=${rid} code=${code} reason=${reason}`);
      safeClose(code, reason);
    });

    clientWs.on("message", (data) => {
      if (!dgOpen) queue.push(data);
      else { try { dgWs.send(data); } catch {} }
    });

    clientWs.on("error", (err) => {
      logger.error(`[WS] client error rid=${rid} ${err?.message || err}`);
      safeClose(1011, "client_err");
    });

    clientWs.on("close", (code, reason) => {
      logger.info(`[WS] client closed rid=${rid} code=${code} reason=${reason}`);
      safeClose(code, reason);
    });

    const ka = setInterval(() => { try { dgWs.ping(); } catch {} }, 15000);
    clientWs.on("close", () => clearInterval(ka));
    dgWs.on("close", () => clearInterval(ka));
  });

  logger.info("[DG] bridge mounted at /ws/mic");
}

module.exports = setupMicWs;
module.exports.setupMicWs = setupMicWs;
