// backend/index.js
require('dotenv').config();

const http = require('http');
const app = require('./app');

const PORT = process.env.PORT || 8080;
const server = http.createServer(app);

// Deepgram WS bridge koppelen (niet crashen als module ontbreekt)
try {
  const { attachDeepgramMicBridge } = require('./ws/deepgramBridge');
  attachDeepgramMicBridge(server, '/ws/mic');
} catch (e) {
  console.warn('[ws] deepgramBridge not attached:', e?.message || e);
}

server.on('listening', () => {
  console.log(`[calllogix] backend listening on :${PORT}`);
});

server.on('error', (err) => {
  // Log expliciet bij poortconflict
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is al in gebruik (EADDRINUSE). Staat er elders nog een listener aan?`);
  } else {
    console.error('[server error]', err);
  }
  process.exit(1);
});

server.listen(PORT);
