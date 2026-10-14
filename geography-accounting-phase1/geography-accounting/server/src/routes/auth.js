import { Router } from 'express';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool, audit } from '../db/pool.js';
import { handler } from '../middleware/auth.js';

const r = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const creds = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

// A real hash used to equalize timing when the email is unknown.
const DUMMY = await argon2.hash('not-a-real-password', { type: argon2.argon2id });

r.post('/login', loginLimiter, handler(async (req, res) => {
  const { email, password } = creds.parse(req.body);
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const u = rows[0];
  const ok = await argon2.verify(u?.password_hash ?? DUMMY, password);
  if (!u || !u.is_active || !ok) {
    await audit(pool, { action: 'login_failed', entity: 'user', details: { email } });
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  await new Promise((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())));
  req.session.userId = u.id;
  await audit(pool, { userId: u.id, action: 'login', entity: 'user', entityId: u.id });
  res.json({ id: u.id, email: u.email, fullName: u.full_name, role: u.role });
}));

r.post('/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

r.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const { id, email, full_name, role } = req.user;
  res.json({ id, email, fullName: full_name, role });
});

export default r;
