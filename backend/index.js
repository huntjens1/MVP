// Start (CommonJS)
const http = require('http');
const app = require('./app');

const PORT = process.env.PORT || 8080;
const server = http.createServer(app);

// Hook WS upgrade (Deepgram mic bridge)
try {
  require('./ws/deepgramBridge').attach(server, app);
} catch (e) {
  console.warn('[ws] deepgramBridge not attached:', e?.message || e);
}

server.listen(PORT, () => {
  console.log(`[calllogix] backend listening on :${PORT}`);
});
