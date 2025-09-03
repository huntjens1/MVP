const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { strictCors } = require('./middlewares/cors');
const { tenantResolver } = require('./middlewares/tenant');
const { telemetry } = require('./middlewares/telemetry');

const authRouter      = require('./routes/auth');
const wsTokenRouter   = require('./routes/wsToken');
const summarizeRouter = require('./routes/summarize');
const suggestRouter   = require('./routes/suggest');
const feedbackRouter  = require('./routes/feedback');

const app = express();
app.set('trust proxy', 1);
app.disable('etag'); // voorkom 304-responses op /api/me

// === CORS EERST + preflight responder ===
app.use(strictCors);
app.options('*', strictCors);

// === BODY PARSER ===
app.use(express.json({ limit: '1mb' }));

// === TENANT RESOLVER (na CORS, vóór security/logging/routes) ===
app.use(tenantResolver);

// === SECURITY ===
app.use(helmet({ crossOriginResourcePolicy: false }));

// === TELEMETRY ===
app.use(telemetry);

// === LOGGING ===
morgan.token('tenant', (_req, res) => (res?.locals?.tenant_id || 'unknown'));
morgan.token('rid', (_req, res) => (res?.locals?.request_id || '-'));
app.use(morgan(':method :url :status :res[content-length] - :response-time ms tenant=:tenant rid=:rid'));

// === RATE LIMITS ===
const generalLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/api/', generalLimiter);
const tokenLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/api/ws-token', tokenLimiter);

// === HEALTH ===
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ====================== ROUTES ====================== */
app.use('/api', authRouter);             // /api/login, /api/logout, /api/me
app.use('/api/auth', authRouter);        // alias

app.use('/api/ws-token', wsTokenRouter);
app.use('/api/summarize', summarizeRouter);
app.use('/api/suggest', suggestRouter);
app.use('/api/feedback', feedbackRouter);

// Compat-aliassen
app.use('/ws-token', wsTokenRouter);
app.use('/api/ai/summarize', summarizeRouter);
app.use('/api/ai/feedback', feedbackRouter);
app.use('/api/suggestQuestion', suggestRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

module.exports = app;
