const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

const corsMiddleware = require('./middlewares/cors');             // <-- zonder accolades
const errorHandler = require('./middlewares/errorHandler');       // <-- CommonJS export

const app = express();

// --- Security & infra
app.disable('x-powered-by');
app.set('trust proxy', 1);

// --- Parsers
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// --- CORS (met credentials + preflight)
app.use(corsMiddleware);                                          // <-- geef de functie door, niet aanroepen

// --- Logging & gzip
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(compression());

// --- Static (optioneel)
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- API routes (CommonJS routers)
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/wsToken'));
app.use('/api', require('./routes/conversations'));
app.use('/api', require('./routes/transcripts'));
app.use('/api', require('./routes/summarize'));
app.use('/api', require('./routes/suggestions'));
app.use('/api', require('./routes/assistStream'));

// Optioneel: overige bestaande routers als ze aanwezig zijn
[
  './routes/assist',
  './routes/analytics',
  './routes/feedback',
  './routes/aiFeedback',
  './routes/tenants',
  './routes/ticket',
  './routes/suggest',
  './routes/suggestQuestion',
].forEach(p => {
  try { app.use('/api', require(p)); } catch (_) {}
});

// --- 404
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// --- Global error handler
app.use(errorHandler);

module.exports = app;
