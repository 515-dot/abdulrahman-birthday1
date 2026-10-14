// In-browser implementation of the server API, used ONLY for the static (GitHub Pages) build.
// Same rules as the server: integer piastres (BigInt), balanced double entries, creator cannot approve.
// Data lives in this browser's localStorage. It is a demo/trial edition, not a system of record.
import { ApiError } from './api';

type Role = 'super_admin' | 'cashier';
type U = { id: string; email: string; fullName: string; role: Role; password: string };
type A = { id: string; code: string; name_ar: string; name_en: string; type: string; is_cash_or_bank: boolean };
type T = { id: string; reference: string; kind: 'income' | 'expense'; tx_date: string; description: string; category_account_id: string;
  cash_account_id: string; amount: string; status: string; created_by: string; approved_by?: string; rejected_reason?: string; document_no?: string; payment_method: string };
type Line = { accountId: string; debit: string; credit: string };
type JE = { id: string; entry_date: string; description: string; lines: Line[] };
type DB = { users: U[]; accounts: A[]; txs: T[]; entries: JE[]; seq: number; session: string | null };

const KEY = 'geo.static.v1';
const COA: [string, string, string, string, boolean][] = [
  ['1000', 'الأصول', 'Assets', 'asset', false], ['1010', 'الصندوق', 'Cash on Hand', 'asset', true], ['1020', 'البنك الرئيسي', 'Main Bank Account', 'asset', true],
  ['1100', 'العملاء (مدينون)', 'Accounts Receivable', 'asset', false], ['2000', 'الخصوم', 'Liabilities', 'liability', false],
  ['2100', 'الموردون (دائنون)', 'Accounts Payable', 'liability', false], ['3000', 'حقوق الملكية', 'Equity', 'equity', false],
  ['4000', 'الإيرادات', 'Revenue', 'revenue', false], ['4100', 'إيرادات عمولات الوساطة', 'Commission Revenue', 'revenue', false], ['4900', 'إيرادات أخرى', 'Other Income', 'revenue', false],
  ['5000', 'المصروفات', 'Expenses', 'expense', false], ['5100', 'الرواتب', 'Salaries', 'expense', false], ['5200', 'إيجار المكتب', 'Office Rent', 'expense', false],
  ['5300', 'التسويق والإعلان', 'Marketing & Advertising', 'expense', false], ['5400', 'المواصلات', 'Transportation', 'expense', false], ['5500', 'المرافق', 'Utilities', 'expense', false],
  ['5600', 'اشتراكات البرامج', 'Software Subscriptions', 'expense', false], ['5700', 'مستلزمات المكتب', 'Office Supplies', 'expense', false],
  ['5800', 'خدمات مهنية', 'Professional Services', 'expense', false], ['5900', 'عمولات السماسرة', 'Broker Commission Expense', 'expense', false], ['5990', 'مصروفات أخرى معتمدة', 'Other Approved Expenses', 'expense', false],
];

function fresh(): DB {
  return {
    users: [
      { id: '1', email: 'admin@demo.local', fullName: 'Demo Admin', role: 'super_admin', password: 'demo-admin' },
      { id: '2', email: 'cashier@demo.local', fullName: 'Demo Cashier', role: 'cashier', password: 'demo-cashier' },
    ],
    accounts: COA.map(([code, ar, en, type, cash], i) => ({ id: String(i + 1), code, name_ar: ar, name_en: en, type, is_cash_or_bank: cash })),
    txs: [], entries: [], seq: 0, session: null,
  };
}
let mem: DB | null = null;
function load(): DB {
  if (mem) return mem;
  try { const raw = localStorage.getItem(KEY); if (raw) return (mem = JSON.parse(raw) as DB); } catch { /* storage unavailable: stay in memory */ }
  return (mem = fresh());
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* ignore */ } }

const parseMoney = (s: string): bigint => {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(s).trim());
  if (!m) throw new ApiError(400, 'Invalid amount');
  return BigInt(m[1]) * 100n + BigInt((m[2] ?? '').padEnd(2, '0'));
};
const fmtMoney = (v: bigint) => { const n = v < 0n; const a = n ? -v : v; return `${n ? '-' : ''}${a / 100n}.${(a % 100n).toString().padStart(2, '0')}`; };
const present = (t: T) => ({ ...t, amount: fmtMoney(BigInt(t.amount)) });
const today = () => new Date().toISOString().slice(0, 10);

export async function handle(path: string, method: string, body: unknown): Promise<unknown> {
  const db = load();
  const [pathname, qs = ''] = path.split('?');
  const q = new URLSearchParams(qs);
  const b = (body ?? {}) as Record<string, string>;
  const me = db.users.find((u) => u.id === db.session);

  if (pathname === '/auth/login' && method === 'POST') {
    const u = db.users.find((x) => x.email === String(b.email).toLowerCase().trim() && x.password === b.password);
    if (!u) throw new ApiError(401, 'Invalid email or password');
    db.session = u.id; save();
    return { id: u.id, email: u.email, fullName: u.fullName, role: u.role };
  }
  if (pathname === '/auth/logout') { db.session = null; save(); return { ok: true }; }
  if (!me) throw new ApiError(401, 'Authentication required');
  if (pathname === '/auth/me') return { id: me.id, email: me.email, fullName: me.fullName, role: me.role };
  if (pathname === '/accounts') return db.accounts;

  if (pathname === '/dashboard') {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(q.get('from') ?? '') ? q.get('from')! : today().slice(0, 8) + '01';
    const to = /^\d{4}-\d{2}-\d{2}$/.test(q.get('to') ?? '') ? q.get('to')! : today();
    const acct = (id: string) => db.accounts.find((a) => a.id === id)!;
    const cashBal = new Map<string, bigint>();
    let income = 0n, expenses = 0n;
    const monthly: Record<string, { income: bigint; expenses: bigint }> = {};
    for (const e of db.entries) {
      for (const l of e.lines) {
        const a = acct(l.accountId); const net = BigInt(l.debit) - BigInt(l.credit);
        if (a.is_cash_or_bank && e.entry_date <= to) cashBal.set(a.id, (cashBal.get(a.id) ?? 0n) + net);
        if (e.entry_date >= from && e.entry_date <= to && (a.type === 'revenue' || a.type === 'expense')) {
          const m = (monthly[e.entry_date.slice(0, 7)] ??= { income: 0n, expenses: 0n });
          if (a.type === 'revenue') { income -= net; m.income -= net; } else { expenses += net; m.expenses += net; }
        }
      }
    }
    const cashAccts = db.accounts.filter((a) => a.is_cash_or_bank);
    return {
      period: { from, to },
      cashAndBank: {
        total: fmtMoney([...cashBal.values()].reduce((x, y) => x + y, 0n)),
        accounts: cashAccts.map((a) => ({ id: a.id, code: a.code, nameAr: a.name_ar, nameEn: a.name_en, balance: fmtMoney(cashBal.get(a.id) ?? 0n) })),
      },
      income: fmtMoney(income), expenses: fmtMoney(expenses), netProfit: fmtMoney(income - expenses),
      monthly: Object.entries(monthly).sort().map(([month, v]) => ({ month, income: fmtMoney(v.income), expenses: fmtMoney(v.expenses) })),
      pendingApprovals: db.txs.filter((t) => t.status === 'pending_approval').length,
      latestTransactions: [...db.txs].reverse().slice(0, 10).map(present),
    };
  }

  if (pathname === '/transactions' && method === 'GET') {
    return [...db.txs].reverse().filter((t) => (!q.get('status') || t.status === q.get('status')) && (!q.get('kind') || t.kind === q.get('kind'))).map(present);
  }
  if (pathname === '/transactions' && method === 'POST') {
    const amount = parseMoney(b.amount);
    if (amount <= 0n) throw new ApiError(400, 'Amount must be greater than zero');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.txDate) || !String(b.description ?? '').trim()) throw new ApiError(400, 'Validation failed');
    const cat = db.accounts.find((a) => a.id === String(b.categoryAccountId));
    const cash = db.accounts.find((a) => a.id === String(b.cashAccountId));
    if (!cash?.is_cash_or_bank) throw new ApiError(400, 'Payment account must be a cash or bank account');
    if (!cat || cat.type !== (b.kind === 'income' ? 'revenue' : 'expense')) throw new ApiError(400, 'Category does not match transaction type');
    if (b.documentNo && db.txs.some((t) => t.status !== 'rejected' && t.document_no === b.documentNo && t.cash_account_id === cash.id && t.tx_date === b.txDate && t.amount === String(amount)))
      throw new ApiError(409, 'Duplicate record');
    const t: T = { id: String(db.txs.length + 1), reference: `TX-${String(++db.seq).padStart(6, '0')}`, kind: b.kind as 'income' | 'expense', tx_date: b.txDate,
      description: b.description.trim().slice(0, 500), category_account_id: cat.id, cash_account_id: cash.id, amount: String(amount), status: 'draft',
      created_by: me.id, document_no: b.documentNo || undefined, payment_method: b.paymentMethod ?? 'cash' };
    db.txs.push(t); save();
    return present(t);
  }
  const m = /^\/transactions\/(\d+)\/(submit|approve|reject)$/.exec(pathname);
  if (m && method === 'POST') {
    const t = db.txs.find((x) => x.id === m[1]);
    if (!t) throw new ApiError(404, 'Transaction not found');
    if (m[2] === 'submit') {
      if (t.status !== 'draft' || t.created_by !== me.id) throw new ApiError(409, 'Only your own draft transactions can be submitted');
      t.status = 'pending_approval';
    } else {
      if (me.role !== 'super_admin') throw new ApiError(403, 'Forbidden');
      if (t.status !== 'pending_approval') throw new ApiError(409, 'Transaction is not pending approval');
      if (t.created_by === me.id) throw new ApiError(403, 'Creator cannot approve their own transaction');
      if (m[2] === 'reject') {
        if (!String(b.reason ?? '').trim()) throw new ApiError(400, 'Validation failed');
        t.status = 'rejected'; t.rejected_reason = b.reason;
      } else {
        const inc = t.kind === 'income';
        const lines: Line[] = [
          { accountId: inc ? t.cash_account_id : t.category_account_id, debit: t.amount, credit: '0' },
          { accountId: inc ? t.category_account_id : t.cash_account_id, debit: '0', credit: t.amount },
        ];
        if (lines.reduce((s, l) => s + BigInt(l.debit), 0n) !== lines.reduce((s, l) => s + BigInt(l.credit), 0n)) throw new ApiError(500, 'Unbalanced entry');
        db.entries.push({ id: String(db.entries.length + 1), entry_date: t.tx_date, description: `${t.reference}: ${t.description}`, lines });
        t.status = 'posted'; t.approved_by = me.id;
      }
    }
    save();
    return present(t);
  }
  throw new ApiError(404, 'Not found');
}
