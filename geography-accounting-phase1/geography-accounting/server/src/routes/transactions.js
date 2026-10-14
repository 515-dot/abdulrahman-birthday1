import { Router } from 'express';
import { z } from 'zod';
import { pool, withTx, audit } from '../db/pool.js';
import { requirePermission, handler, HttpError } from '../middleware/auth.js';
import { parseMoney, formatMoney } from '../lib/money.js';
import { validateLines } from '../lib/journal.js';
import { canApprove } from '../lib/permissions.js';

const r = Router();

const createSchema = z.object({
  kind: z.enum(['income', 'expense']),
  txDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(500),
  categoryAccountId: z.coerce.number().int().positive(),
  cashAccountId: z.coerce.number().int().positive(),
  amount: z.string(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'cheque', 'card', 'other']).default('cash'),
  documentNo: z.string().max(100).optional(),
});

const present = (t) => ({ ...t, amount: formatMoney(t.amount) });

r.get('/', requirePermission('tx:read'), handler(async (req, res) => {
  const { status, kind, from, to, q } = req.query;
  const params = [];
  const where = ['is_demo = FALSE'];
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  if (kind) { params.push(kind); where.push(`kind = $${params.length}`); }
  if (from) { params.push(from); where.push(`tx_date >= $${params.length}`); }
  if (to) { params.push(to); where.push(`tx_date <= $${params.length}`); }
  if (q) { params.push(`%${q}%`); where.push(`(description ILIKE $${params.length} OR reference ILIKE $${params.length})`); }
  const { rows } = await pool.query(`SELECT * FROM transactions WHERE ${where.join(' AND ')} ORDER BY tx_date DESC, id DESC LIMIT 500`, params);
  res.json(rows.map(present));
}));

r.post('/', requirePermission('tx:create'), handler(async (req, res) => {
  const b = createSchema.parse(req.body);
  const amount = parseMoney(b.amount);
  if (amount <= 0n) throw new HttpError(400, 'Amount must be greater than zero');
  const out = await withTx(async (c) => {
    const accts = (await c.query('SELECT id, type, is_cash_or_bank FROM accounts WHERE id = ANY($1) AND is_active', [[b.categoryAccountId, b.cashAccountId]])).rows;
    const cat = accts.find((a) => a.id === BigInt(b.categoryAccountId));
    const cash = accts.find((a) => a.id === BigInt(b.cashAccountId));
    if (!cash?.is_cash_or_bank) throw new HttpError(400, 'Payment account must be a cash or bank account');
    if (!cat || cat.type !== (b.kind === 'income' ? 'revenue' : 'expense')) throw new HttpError(400, 'Category does not match transaction type');
    const { rows } = await c.query(
      `INSERT INTO transactions (kind, tx_date, description, category_account_id, cash_account_id, amount, payment_method, document_no, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [b.kind, b.txDate, b.description, b.categoryAccountId, b.cashAccountId, amount, b.paymentMethod, b.documentNo ?? null, req.user.id],
    );
    await audit(c, { userId: req.user.id, action: 'created', entity: 'transaction', entityId: rows[0].id, details: { reference: rows[0].reference, amount } });
    return rows[0];
  });
  res.status(201).json(present(out));
}));

r.post('/:id/submit', requirePermission('tx:create'), handler(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE transactions SET status='pending_approval' WHERE id=$1 AND status='draft' AND created_by=$2 RETURNING *`,
    [req.params.id, req.user.id],
  );
  if (!rows[0]) throw new HttpError(409, 'Only your own draft transactions can be submitted');
  await audit(pool, { userId: req.user.id, action: 'submitted', entity: 'transaction', entityId: rows[0].id });
  res.json(present(rows[0]));
}));

// Approval posts the journal entry atomically: approval and posting succeed or fail together.
r.post('/:id/approve', requirePermission('tx:approve'), handler(async (req, res) => {
  const out = await withTx(async (c) => {
    const t = (await c.query('SELECT * FROM transactions WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!t) throw new HttpError(404, 'Transaction not found');
    if (t.status !== 'pending_approval') throw new HttpError(409, 'Transaction is not pending approval');
    const chk = canApprove({ role: req.user.role, userId: req.user.id, createdBy: t.created_by, amount: t.amount, approvalLimit: req.user.approval_limit });
    if (!chk.ok) throw new HttpError(403, chk.reason);

    const income = t.kind === 'income';
    const lines = [
      { accountId: income ? t.cash_account_id : t.category_account_id, debit: t.amount, credit: 0n },
      { accountId: income ? t.category_account_id : t.cash_account_id, debit: 0n, credit: t.amount },
    ];
    validateLines(lines);
    const je = (await c.query(
      `INSERT INTO journal_entries (entry_date, description, source_type, source_id, created_by, is_demo)
       VALUES ($1,$2,'transaction',$3,$4,$5) RETURNING id`,
      [t.tx_date, `${t.reference}: ${t.description}`, t.id, req.user.id, t.is_demo],
    )).rows[0];
    for (const l of lines) {
      await c.query('INSERT INTO journal_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,$3,$4)', [je.id, l.accountId, l.debit, l.credit]);
    }
    await c.query(`UPDATE journal_entries SET status='posted', posted_by=$2, posted_at=now() WHERE id=$1`, [je.id, req.user.id]);
    const upd = (await c.query(
      `UPDATE transactions SET status='posted', approved_by=$2, journal_entry_id=$3 WHERE id=$1 RETURNING *`,
      [t.id, req.user.id, je.id],
    )).rows[0];
    await audit(c, { userId: req.user.id, action: 'approved_and_posted', entity: 'transaction', entityId: t.id, details: { reference: t.reference, journalEntryId: je.id } });
    return upd;
  });
  res.json(present(out));
}));

r.post('/:id/reject', requirePermission('tx:approve'), handler(async (req, res) => {
  const { reason } = z.object({ reason: z.string().min(1).max(500) }).parse(req.body);
  const { rows } = await pool.query(
    `UPDATE transactions SET status='rejected', rejected_reason=$2 WHERE id=$1 AND status='pending_approval' AND created_by <> $3 RETURNING *`,
    [req.params.id, reason, req.user.id],
  );
  if (!rows[0]) throw new HttpError(409, 'Transaction cannot be rejected by you in its current state');
  await audit(pool, { userId: req.user.id, action: 'rejected', entity: 'transaction', entityId: rows[0].id, details: { reason } });
  res.json(present(rows[0]));
}));

export default r;
