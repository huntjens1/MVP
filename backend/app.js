const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { strictCors } = require('./middlewares/cors');
const { telemetry } = require('./middlewares/telemetry');

// ⬇️ voeg je AUTH router toe
const authRouter      = require('./routes/auth');

const wsTokenRouter   = require('./routes/wsToken');
const summarizeRouter = require('./routes/summarize');
const suggestRouter   = require('./routes/suggest');
const feedbackRouter  = require('./routes/feedback');

const app = express();
app.set('trust proxy', 1);

// === CORS EERST ===
app.use(strictCors);
app.options('*', strictCors);  // Preflight responder

// Security + parsing
app.use(helmet({ crossOriginResourcePolicy: false }));
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

/* ====================== ROUTES ====================== */

// Auth router MOUNTEN zodat /api/login en /api/me bestaan
// Meest gangbaar: routes/auth.js bevat router.post('/login') en router.get('/me')
app.use('/api', authRouter);

// Laat voor de zekerheid ook /api/auth/* werken (mocht je front dat ooit gebruiken)
app.use('/api/auth', authRouter);

// Overige API's
app.use('/api/ws-token', wsTokenRouter);
app.use('/api/summarize', summarizeRouter);
app.use('/api/suggest', suggestRouter);
app.use('/api/feedback', feedbackRouter);

// Aliassen (compat met oudere front-calls)
app.use('/ws-token', wsTokenRouter);
app.use('/api/ai/summarize', summarizeRouter);
app.use('/api/ai/feedback', feedbackRouter);
app.use('/api/suggestQuestion', suggestRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

module.exports = app;
