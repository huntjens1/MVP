import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import dotenv from 'dotenv';
import http from 'http';
import cookieParser from 'cookie-parser';

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

// ▶ Railway/NGINX/Cloud: echte client-IP gebruiken
app.set('trust proxy', 1);

// CORS whitelist
const allowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// Security + basics
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);           // curl/postman
    if (allowed.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Rate‑limit — **IPv6 safe** en geen throttle op streams
const skipStreaming = req => req.path.startsWith('/ws/') || req.path.startsWith('/api/stream/');
const limiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req),     // ✅ IPv4/IPv6 + XFF aware
  skip: skipStreaming,
});
app.use(limiter);

// Routers
app.use(suggestQuestionRouter);
app.use(authRouter);                 // /api/login, /api/logout, /api/me
app.use(aiFeedbackRouter);
app.use(summarizeRoute);
app.use(analyticsRouter);
app.use(transcriptsRouter);
app.use(conversationsRouter);
app.use(tenantsRouter);
app.use(wsTokenRouter);

// SSE (live AI-suggesties)
suggestionsSSE(app);

// Health
app.get('/healthz', (_, res) => res.json({ ok: true }));

// Errors (laatste)
app.use(errorHandler);

// WS Bridge (browser mic -> server -> Deepgram EU)
initMicBridge(server);

// Start
server.listen(PORT, () => {
  console.log(`🚀 Backend draait op http://localhost:${PORT}`);
});
