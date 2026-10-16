import './config.js'; // Must be first - validates env vars

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { notFound, errorHandler, requestLogger } from './middleware/errors.js';
import repositoriesRouter from './routes/repositories.js';
import filesRouter from './routes/files.js';
import searchRouter from './routes/search.js';
import askRouter from './routes/ask.js';
import jobsRouter from './routes/jobs.js';

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
  origin: config.clientUrl,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(limiter);

// Aggressive rate limit for indexing endpoint
const indexingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many indexing requests' },
});

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Request logging
if (config.nodeEnv !== 'test') {
  app.use(requestLogger);
}

// Health endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  try {
    const { testConnection } = await import('./db/pool.js');
    const dbOk = await testConnection();
    if (!dbOk) throw new Error('DB not ready');
    res.json({ status: 'ready', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});

// API routes
app.use('/api/repositories', indexingLimiter);
app.use('/api/repositories', repositoriesRouter);
app.use('/api/repositories/:id/files', filesRouter);
app.use('/api/repositories/:id/search', searchRouter);
app.use('/api/repositories/:id/ask', askRouter);
app.use('/api/jobs', jobsRouter);

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
