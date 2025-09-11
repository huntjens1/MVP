// backend/index.js
// Entry-point: start de HTTP-server rond Express en koppel (optioneel) de Deepgram WS-bridge.
// Houd dit bestand slank en stabiel; alle routes/middleware leven in ./app

require('dotenv').config();
const http = require('http');
const app = require('./app');

// ---- Config ---------------------------------------------------------------
const PORT = normalizePort(process.env.PORT || '8080');

// ---- Server ---------------------------------------------------------------
const server = http.createServer(app);

// Productie-waardige timeouts om “hung sockets” te vermijden
server.keepAliveTimeout = 70_000;  // default 5s is te kort bij proxies
server.headersTimeout   = 75_000;  // moet > keepAliveTimeout zijn

// Debug: laat duidelijk zien met welke settings we starten
console.log('[debug] server boot', {
  node: process.version,
  env: process.env.NODE_ENV || 'development',
  port: PORT,
});

// Probeer de Deepgram mic bridge te koppelen (niet verplicht voor boot)
try {
  const { attachDeepgramMicBridge } = require('./ws/deepgramBridge');
  if (typeof attachDeepgramMicBridge === 'function') {
    attachDeepgramMicBridge(server, '/ws/mic'); // <-- pad voor je mic websocket
    console.log('[ws] Deepgram mic bridge attached on /ws/mic');
  } else {
    console.warn('[ws] deepgramBridge not attached: attachDeepgramMicBridge is not a function');
  }
} catch (err) {
  console.warn('[ws] deepgramBridge not attached:', err && err.message ? err.message : err);
}

// Start luisteren
server.listen(PORT);
server.on('listening', onListening);
server.on('error', onError);

// ---- Process-level guards -------------------------------------------------
process.on('unhandledRejection', (reason, p) => {
  console.error('[fatal] unhandledRejection', { reason, promise: p });
});

process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException', err);
});

// Graceful shutdown voor container/platforms (Railway, Vercel, etc.)
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    console.log(`[server] ${signal} received: closing HTTP server…`);
    server.close((closeErr) => {
      if (closeErr) {
        console.error('[server] error while closing', closeErr);
        process.exit(1);
      }
      console.log('[server] closed cleanly');
      process.exit(0);
    });
  });
});

// ---- Helpers --------------------------------------------------------------
function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string' ? addr : `:${addr.port}`;
  console.log(`[calllogix] backend listening on ${bind}`);
}

function onError(error) {
  if (error.syscall !== 'listen') {
    console.error('[server] error', error);
    throw error;
  }

  const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;

  switch (error.code) {
    case 'EACCES':
      console.error(`[server] ${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`[server] ${bind} is already in use`);
      process.exit(1);
      break;
    default:
      console.error('[server] error', error);
      throw error;
  }
}

function normalizePort(val) {
  const port = parseInt(val, 10);
  if (Number.isNaN(port)) return val; // named pipe
  if (port >= 0) return port;
  return false;
}
