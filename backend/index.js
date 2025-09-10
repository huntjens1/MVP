const http = require('http');
const app = require('./app');

const PORT = process.env.PORT || 8080;
const server = http.createServer(app);

// Probeer de Deepgram bridge te koppelen als die bestaat
let bridge;
try { bridge = require('./ws/deepgramBridge'); } catch {}
try { bridge = bridge || require('./deepgramBridge'); } catch {}

if (bridge && typeof bridge.attach === 'function') {
  bridge.attach(server);                // koppelt je WS ↔ Deepgram
} else {
  console.warn('[ws] deepgramBridge not attached: missing or invalid bridge');
}

server.listen(PORT, () => {
  console.log(`[calllogix] backend listening on :${PORT}`);
});
