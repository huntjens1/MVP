// backend/app.js
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
app.disable('etag'); // voorkom 304 op /api/me (spaarder voor edge-caches)

// ===== CORS & preflight =====
app.use(strictCors);
app.options('*', strictCors);

// ===== Body parsing =====
app.use(express.json({ limit: '1mb' }));

// ===== Tenant scoping (na CORS) =====
app.use(tenantResolver);

// ===== Security =====
app.use(helmet({ crossOriginResourcePolicy: false }));

// ===== Telemetry =====
app.use(telemetry);

// ===== Logging =====
morgan.token('tenant', (_req, res) => (res?.locals?.tenant_id || 'unknown'));
morgan.token('rid',    (_req, res) => (res?.locals?.request_id || '-'));
app.use(morgan(':method :url :status :res[content-length] - :response-time ms tenant=:tenant rid=:rid'));

// ===== Rate limits =====
const generalLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });
const tokenLimiter   = rateLimit({ windowMs: 60_000, limit: 20,  standardHeaders: 'draft-7', legacyHeaders: false });

app.use('/api/', generalLimiter);
app.use('/api/ws-token', tokenLimiter);

// ===== Health =====
app.get('/health', (_req, res) => res.json({ ok: true }));

// ===== Routes =====
app.use('/api', authRouter);              // /api/login, /api/logout, /api/me
app.use('/api/ws-token', wsTokenRouter);  // WebSocket toegangstoken
app.use('/api/summarize', summarizeRouter);
app.use('/api/suggest',   suggestRouter); // POST + SSE stream
app.use('/api/feedback',  feedbackRouter);

// Compat-aliassen (oude frontends)
app.use('/ws-token', wsTokenRouter);
app.use('/api/ai/summarize', summarizeRouter);
app.use('/api/ai/feedback',  feedbackRouter);
app.use('/api/suggestQuestion', suggestRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

module.exports = app;
