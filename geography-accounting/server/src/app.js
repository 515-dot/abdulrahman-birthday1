import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db/pool.js';
import { loadUser, requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import txRoutes from './routes/transactions.js';
import dashboardRoutes from './routes/dashboard.js';

// BigInt money values must serialize as strings in JSON, never as lossy numbers.
BigInt.prototype.toJSON = function () { return this.toString(); };

const secret = process.env.SESSION_SECRET ?? '';
if (secret.length < 32 || /generate-with|change[-_ ]?me/i.test(secret)) {
  throw new Error('SESSION_SECRET must be a random string of at least 32 characters (e.g. `openssl rand -hex 32`)');
}

// Built frontend (web/dist). In production the API serves it, so one container is enough.
const WEB_DIST = process.env.WEB_DIST
  ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'dist');

export function createApp() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  const PgStore = connectPgSimple(session);
  app.use(session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    name: 'geo.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', secure: isProd, maxAge: 8 * 60 * 60 * 1000 },
  }));
  app.use(loadUser);

  // CSRF defence in addition to SameSite=strict: state-changing requests must be JSON.
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) {
      return res.status(415).json({ error: 'JSON required' });
    }
    next();
  });

  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

  // Liveness + database reachability, for load balancers and container health checks.
  app.get('/api/health', async (req, res) => {
    try { await pool.query('SELECT 1'); res.json({ ok: true }); }
    catch { res.status(503).json({ ok: false }); }
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', requireAuth, accountRoutes);
  app.use('/api/transactions', requireAuth, txRoutes);
  app.use('/api/dashboard', requireAuth, dashboardRoutes);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  if (fs.existsSync(path.join(WEB_DIST, 'index.html'))) {
    app.use('/assets', express.static(path.join(WEB_DIST, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(WEB_DIST, { maxAge: '1h', index: false }));
    app.get('*', (req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
  }

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
