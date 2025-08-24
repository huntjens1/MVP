import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import http from 'http';

import suggestQuestionRouter from './routes/suggestQuestion.js';
import authRouter from './routes/auth.js';
import aiFeedbackRouter from './routes/aiFeedback.js';
import summarizeRoute from './routes/summarize.js';
import analyticsRouter from './routes/analytics.js';
import transcriptsRouter from './routes/transcripts.js';
import conversationsRouter from './routes/conversations.js';
import tenantsRouter from './routes/tenants.js';
import wsTokenRouter from './routes/wsToken.js';

import { suggestionsSSE } from './streams/suggestionsSSE.js';
import { initMicBridge } from './ws/deepgramBridge.js';
import { errorHandler } from './middlewares/errorHandler.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

/** CORS whitelist */
const allowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** ▶️ Belangrijk op Railway/NGINX/Cloud proxies */
app.set('trust proxy', 1); // 1 hop is genoeg voor Railway; zet true bij complexere ketens

/** Security headers */
app.use(helmet({ crossOriginResourcePolicy: false }));

/** CORS: alleen whitelisted origins */
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow curl/postman
      if (allowed.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

/** Body parsing */
app.use(express.json({ limit: '2mb' }));

/** Rate‑limit – skip SSE & WS routes (anders breek je streams) */
const skipStreaming = (req) =>
  req.path.startsWith('/ws/') || req.path.startsWith('/api/stream/');

const realIp = (req) =>
  req.headers['cf-connecting-ip'] ||
  req.headers['x-real-ip'] ||
  req.ip;

const limiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true, // RateLimit-* headers
  legacyHeaders: false,
  keyGenerator: realIp,
  skip: skipStreaming,
});

app.use(limiter);

/** Routers */
app.use(suggestQuestionRouter);
app.use(authRouter);
app.use(aiFeedbackRouter);
app.use(summarizeRoute);
app.use(analyticsRouter);
app.use(transcriptsRouter);
app.use(conversationsRouter);
app.use(tenantsRouter);
app.use(wsTokenRouter);

/** SSE (live AI-suggesties) */
suggestionsSSE(app);

/** Health */
app.get('/healthz', (_req, res) => res.json({ ok: true }));

/** Error handler (laatste middleware) */
app.use(errorHandler);

/** WS Bridge (browser mic -> server -> Deepgram EU) */
initMicBridge(server);

/** Start */
server.listen(PORT, () => {
  console.log(`🚀 Backend draait op http://localhost:${PORT}`);
});
