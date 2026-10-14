import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requirePermission, handler } from '../middleware/auth.js';
import { formatMoney } from '../lib/money.js';

const r = Router();

/*
 * KPI definitions (Phase 1, all from POSTED journal lines, demo data excluded):
 *  - cashAndBank:   sum(debit - credit) on accounts flagged is_cash_or_bank, as of the end date.
 *  - income:        sum(credit - debit) on revenue accounts with entry_date in the period.
 *  - expenses:      sum(debit - credit) on expense accounts with entry_date in the period.
 *  - netProfit:     income - expenses.
 * Receivables, payables, and commission metrics arrive in Phase 2 and are not shown until real.
 */
r.get('/', requirePermission('reports:read'), handler(async (req, res) => {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from ?? '') ? req.query.from : new Date().toISOString().slice(0, 8) + '01';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to ?? '') ? req.query.to : new Date().toISOString().slice(0, 10);

  const base = `FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id JOIN accounts a ON a.id = l.account_id
                WHERE e.status = 'posted' AND e.is_demo = FALSE`;
  const cash = await pool.query(`SELECT a.id, a.code, a.name_ar, a.name_en, COALESCE(SUM(l.debit - l.credit),0) AS balance
    FROM accounts a LEFT JOIN journal_lines l ON l.account_id = a.id
    LEFT JOIN journal_entries e ON e.id = l.entry_id AND e.status='posted' AND e.is_demo = FALSE AND e.entry_date <= $1
    WHERE a.is_cash_or_bank GROUP BY a.id ORDER BY a.code`, [to]);
  const period = await pool.query(
    `SELECT a.type, to_char(date_trunc('month', e.entry_date), 'YYYY-MM') AS month,
            COALESCE(SUM(CASE WHEN a.type='revenue' THEN l.credit - l.debit ELSE l.debit - l.credit END),0) AS amount
     ${base} AND a.type IN ('revenue','expense') AND e.entry_date BETWEEN $1 AND $2 GROUP BY 1,2 ORDER BY 2`, [from, to]);
  const pending = await pool.query(`SELECT COUNT(*)::int AS n FROM transactions WHERE status='pending_approval' AND is_demo = FALSE`);
  const latest = await pool.query(`SELECT id, reference, kind, tx_date, description, amount, status FROM transactions WHERE is_demo = FALSE ORDER BY id DESC LIMIT 10`);

  let income = 0n, expenses = 0n;
  const monthly = {};
  for (const row of period.rows) {
    (monthly[row.month] ??= { income: 0n, expenses: 0n });
    if (row.type === 'revenue') { income += row.amount; monthly[row.month].income += row.amount; }
    else { expenses += row.amount; monthly[row.month].expenses += row.amount; }
  }
  res.json({
    period: { from, to },
    cashAndBank: { total: formatMoney(cash.rows.reduce((t, x) => t + x.balance, 0n)), accounts: cash.rows.map((x) => ({ id: x.id, code: x.code, nameAr: x.name_ar, nameEn: x.name_en, balance: formatMoney(x.balance) })) },
    income: formatMoney(income),
    expenses: formatMoney(expenses),
    netProfit: formatMoney(income - expenses),
    monthly: Object.entries(monthly).map(([month, v]) => ({ month, income: formatMoney(v.income), expenses: formatMoney(v.expenses) })),
    pendingApprovals: pending.rows[0].n,
    latestTransactions: latest.rows.map((t) => ({ ...t, amount: formatMoney(t.amount) })),
  });
}));

export default r;
