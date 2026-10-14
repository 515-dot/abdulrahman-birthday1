import 'dotenv/config';
import express from 'express';
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

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters');
}

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

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', requireAuth, accountRoutes);
  app.use('/api/transactions', requireAuth, txRoutes);
  app.use('/api/dashboard', requireAuth, dashboardRoutes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
