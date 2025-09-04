// Entry: start Express én WebSocket-upgrade
const http = require('http');
const app = require('./app');
const { setupMicWs } = require('./ws/deepgramBridge');

const PORT = process.env.PORT || 8080;

// Maak 1 HTTP server en hang Express + WS eraan
const server = http.createServer(app);

// WebSocket route voor /ws/mic
setupMicWs(server);

// Starten
server.listen(PORT, () => {
  console.log(`[calllogix] backend listening on :${PORT}`);
});
