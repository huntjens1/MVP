// Entry: start Express + WebSocket upgrade
const http = require('http');
const app = require('./app');
const { setupMicWs } = require('./ws/deepgramBridge');

const PORT = process.env.PORT || 8080;

const server = http.createServer(app);
setupMicWs(server);

server.listen(PORT, () => {
  console.log(`[calllogix] backend listening on :${PORT}`);
});
