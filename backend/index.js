// backend/index.js
const http = require("http");
const app = require("./app");
const setupMicWs = require("./ws/deepgramBridge");

const PORT = process.env.PORT || 8080;

const server = http.createServer(app);

// Mount de Deepgram WS-bridge (export dekt beide varianten)
setupMicWs(server, app, console);

server.listen(PORT, () => {
  console.log(`[calllogix] backend listening on :${PORT}`);
});
