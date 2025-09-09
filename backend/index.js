"use strict";

/**
 * CallLogix backend entrypoint
 * - Start HTTP server
 * - Mount Deepgram mic WebSocket bridge
 * - Harden timeouts & graceful shutdown
 */

const http = require("http");
const app = require("./app");
const _setupMicWs = require("./ws/deepgramBridge");

// Normaliseer export (werkt met zowel module.exports als default export)
const setupMicWs = (_setupMicWs && _setupMicWs.default) ? _setupMicWs.default : _setupMicWs;

const PORT = Number(process.env.PORT || 8080);

const server = http.createServer(app);

// Harden Node timeouts t.b.v. proxies (Railway/Vercel/NGINX)
server.keepAliveTimeout = 65_000; // 65s
server.headersTimeout   = 66_000; // > keepAliveTimeout

// Mount de Deepgram WS-bridge (handelt de 'upgrade' events zelf af)
setupMicWs(server, app, console);

server.listen(PORT, () => {
  console.log(`[calllogix] backend listening on :${PORT}`);
});

// Graceful shutdown
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[calllogix] received ${sig}, shutting down...`);
    server.close(() => process.exit(0));
    // Fallback hard-exit na 10s als er hangende verbindingen zijn
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
