const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

const { corsMiddleware } = require('./middlewares/cors');
const { errorHandler } = require('./middlewares/errorHandler'); // laat je bestaande handler staan

const app = express();

// --- Security & infra
app.disable('x-powered-by');
app.set('trust proxy', 1);

// --- Parsers
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// --- CORS (met credentials)
app.use(corsMiddleware());

// --- Logging & gzip
app.use(morgan('dev'));
app.use(compression());

// --- Static (optioneel)
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- API routes (allemaal CommonJS routers)
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/wsToken'));
app.use('/api', require('./routes/conversations'));
app.use('/api', require('./routes/transcripts'));
app.use('/api', require('./routes/summarize'));
app.use('/api', require('./routes/suggestions'));
app.use('/api', require('./routes/assistStream'));

// Optioneel: overige bestaande routers als je die gebruikt
try { app.use('/api', require('./routes/assist')); } catch {}
try { app.use('/api', require('./routes/analytics')); } catch {}
try { app.use('/api', require('./routes/feedback')); } catch {}
try { app.use('/api', require('./routes/aiFeedback')); } catch {}
try { app.use('/api', require('./routes/tenants')); } catch {}
try { app.use('/api', require('./routes/ticket')); } catch {}
try { app.use('/api', require('./routes/suggest')); } catch {}
try { app.use('/api', require('./routes/suggestQuestion')); } catch {}

// --- Fallback not found
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// --- Global error handler (laat je eigen implementatie bestaan)
app.use(errorHandler || ((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
}));

module.exports = app;
