/* backend/app.js */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const app = express();

// ----------- CORS ----------
const allowOrigins = [
  // vercel front-end
  /^https:\/\/mvp-[a-z0-9-]+\.vercel\.app$/,
  // lokale dev
  'http://localhost:5173'
];

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl/postman
    if (allowOrigins.some(o => (o instanceof RegExp ? o.test(origin) : o === origin))) {
      return cb(null, true);
    }
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// ----------- common middlewares ----------
app.use(morgan('combined'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ----------- health ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ----------- routes (CJS of ESM – beide werken nu) ----------
app.use('/api', require('./routes/auth'));              // POST /login, GET /me, POST /logout (voorbeeld)
app.use('/api', require('./routes/wsToken'));           // POST /ws-token
app.use('/api', require('./routes/conversations'));     // GET /conversations, etc.
app.use('/api', require('./routes/transcripts'));       // transcript endpoints
app.use('/api', require('./routes/summarize'));         // POST /summarize
app.use('/api', require('./routes/suggest'));           // GET /suggestions
app.use('/api', require('./routes/aiFeedback'));        // POST /ai-feedback
app.use('/api', require('./routes/feedback'));          // POST /feedback
app.use('/api', require('./routes/analytics'));         // analytics endpoints
app.use('/api', require('./routes/tenants'));           // tenant endpoints
app.use('/api', require('./routes/suggestQuestion'));   // suggest-question
app.use('/api', require('./routes/assist-stream'));     // GET /assist-stream (als je die als aparte route hebt)

// ------------- 404 / error -------------
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
