const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { strictCors } = require('./cors');
const { telemetry } = require('./telemetry');

const wsTokenRouter = require('./wsToken');
const summarizeRouter = require('./summarize');
const suggestRouter = require('./suggest');
const feedbackRouter = require('./feedback'); // ⬅️ NIEUW bestand — zie hieronder

const app = express();
app.set('trust proxy', 1);

// Security + parsing
app.use(helmet());
app.use(strictCors);
app.use(express.json({ limit: '1mb' }));

// Telemetry
app.use(telemetry);

// Logging met tenant + request-id
morgan.token('tenant', (_req, res) => (res?.locals?.tenant_id || 'unknown'));
morgan.token('rid', (_req, res) => (res?.locals?.request_id || '-'));
app.use(morgan(':method :url :status :res[content-length] - :response-time ms tenant=:tenant rid=:rid'));

// Rate limits
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

const tokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api/ws-token', tokenLimiter);

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Canonieke routes
app.use('/api/ws-token', wsTokenRouter);
app.use('/api/summarize', summarizeRouter);
app.use('/api/suggest', suggestRouter);
app.use('/api/feedback', feedbackRouter);

// Aliassen voor bestaande frontend-calls (laat staan tot front is omgezet)
app.use('/ws-token', wsTokenRouter);
app.use('/api/ai/summarize', summarizeRouter);
app.use('/api/ai/feedback', feedbackRouter);
app.use('/api/suggestQuestion', suggestRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

module.exports = app;
