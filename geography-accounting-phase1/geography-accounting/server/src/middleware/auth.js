import { can } from '../lib/permissions.js';
import { pool } from '../db/pool.js';

/** Loads the user fresh from the DB on every request so deactivation and role changes apply immediately. */
export async function loadUser(req, res, next) {
  const id = req.session?.userId;
  if (!id) return next();
  const { rows } = await pool.query('SELECT id, email, full_name, role, approval_limit, is_active FROM users WHERE id = $1', [id]);
  if (!rows[0] || !rows[0].is_active) {
    req.session.destroy(() => {});
    return next();
  }
  req.user = rows[0];
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

export const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!can(req.user.role, permission)) return res.status(403).json({ error: 'Forbidden' });
  next();
};

/** Wraps async handlers and converts known domain errors into 4xx responses. */
export const handler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((e) => {
    if (e?.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', issues: e.issues });
    if (['MoneyError', 'JournalError', 'HttpError'].includes(e?.constructor?.name)) return res.status(e.status ?? 400).json({ error: e.message });
    if (e?.code === '23505') return res.status(409).json({ error: 'Duplicate record' });
    next(e);
  });

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
