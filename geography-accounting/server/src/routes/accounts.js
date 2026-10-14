import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requirePermission, handler } from '../middleware/auth.js';

const r = Router();

r.get('/', requirePermission('accounts:read'), handler(async (req, res) => {
  const { rows } = await pool.query('SELECT id, code, name_ar, name_en, type, is_cash_or_bank, is_active FROM accounts ORDER BY code');
  res.json(rows);
}));

export default r;
