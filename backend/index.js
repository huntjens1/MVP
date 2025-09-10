// Startpunt (CommonJS)
const http = require('http');
const app = require('./app');

const PORT = process.env.PORT || 8080;
const server = http.createServer(app);

// (optioneel) ws-upgrade handler wordt in ./ws/deepgramBridge.js gehooked
try {
  require('./ws/deepgramBridge').attach(server, app);
} catch (e) {
  console.warn('[ws] deepgramBridge not attached:', e?.message || e);
}

server.listen(PORT, () => {
  console.log(`[calllogix] backend listening on :${PORT}`);
});
