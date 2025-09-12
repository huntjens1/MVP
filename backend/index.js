// backend/index.js
// Entry-point: start HTTP-server rond Express en koppel Deepgram WS-bridge.

require('dotenv').config();
const http = require('http');
const app = require('./app');
const { attach: attachDeepgramBridge } = require('./ws/deepgramBridge');

const PORT = normalizePort(process.env.PORT || '8080');
const server = http.createServer(app);

// Productie timeouts achter proxies
server.keepAliveTimeout = 70_000;
server.headersTimeout   = 75_000;
server.requestTimeout   = 120_000;

// WebSocket bridge voor /ws/mic
attachDeepgramBridge(server);

server.listen(PORT, () => {
  console.debug('[server] boot', { port: PORT, env: process.env.NODE_ENV });
});

server.on('error', onError);
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

function shutdown(signal) {
  console.debug('[server] shutdown', { signal });
  server.close(err => {
    if (err) {
      console.error('[server] close error', { error: err?.message });
      process.exit(1);
    }
    console.debug('[server] closed');
    process.exit(0);
  });
}

function onError(error) {
  if (error.syscall !== 'listen') throw error;
  const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;
  switch (error.code) {
    case 'EACCES':   console.error('[server] requires elevated privileges', { bind }); process.exit(1);
    case 'EADDRINUSE': console.error('[server] address in use', { bind }); process.exit(1);
    default:         console.error('[server] error', { message: error?.message }); throw error;
  }
}

function normalizePort(val) {
  const port = parseInt(val, 10);
  if (Number.isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
}
