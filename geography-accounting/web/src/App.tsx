import { useEffect, useState, useCallback } from 'react';
import { api, fmt, ApiError } from './lib/api';
import { t, Lang, Key } from './lib/i18n';

type User = { id: string; email: string; fullName: string; role: string };
type Account = { id: string; code: string; name_ar: string; name_en: string; type: string; is_cash_or_bank: boolean };
type Tx = { id: string; reference: string; kind: 'income' | 'expense'; tx_date: string; description: string; amount: string; status: string; created_by?: string };
type Dash = {
  period: { from: string; to: string };
  cashAndBank: { total: string; accounts: { id: string; code: string; nameAr: string; nameEn: string; balance: string }[] };
  income: string; expenses: string; netProfit: string; pendingApprovals: number;
  monthly: { month: string; income: string; expenses: string }[];
  latestTransactions: Tx[];
};

const LOGO = `${import.meta.env.BASE_URL}logo.jpg`; // original file, displayed unmodified

export default function App() {
  const [lang, setLang] = useState<Lang>('ar');
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [page, setPage] = useState<'dashboard' | 'transactions'>('dashboard');

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);
  useEffect(() => { api<User>('/auth/me').then(setUser).catch(() => setUser(null)); }, []);

  if (user === undefined) return null;
  if (!user) return <Login lang={lang} onDone={setUser} />;

  const L = (k: Key) => t(lang, k);
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo"><img src={LOGO} alt="Geography Real Estate" /></div>
        <nav className="nav">
          {(['dashboard', 'transactions'] as const).map((p) => (
            <button key={p} aria-current={page === p ? 'page' : undefined} onClick={() => setPage(p)}>{L(p)}</button>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
          <button className="btn" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'English' : 'العربية'}</button>
          <button className="btn" onClick={() => api('/auth/logout', { method: 'POST', body: {} }).then(() => setUser(null))}>{L('logout')}</button>
        </div>
      </aside>
      <main className="main">
        {page === 'dashboard' ? <Dashboard lang={lang} /> : <Transactions lang={lang} user={user} />}
      </main>
    </div>
  );
}

function Login({ lang, onDone }: { lang: Lang; onDone: (u: User) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  return (
    <form className="card login" onSubmit={async (e) => {
      e.preventDefault();
      try { onDone(await api<User>('/auth/login', { method: 'POST', body: { email, password } })); }
      catch (x) { setErr(x instanceof ApiError ? x.message : 'Error'); }
    }}>
      <img src={LOGO} alt="Geography Real Estate" />
      <label>{t(lang, 'email')}<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
      <label style={{ marginTop: 12 }}>{t(lang, 'password')}<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
      {err && <div className="error" role="alert">{err}</div>}
      <button className="btn accent" style={{ marginTop: 16, width: '100%' }}>{t(lang, 'login')}</button>
      {import.meta.env.VITE_STATIC && (
        <p style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {lang === 'ar'
            ? 'نسخة تجريبية تعمل داخل المتصفح فقط، والبيانات لا تُحفظ على أي خادم. للاستخدام الفعلي استخدم النسخة ذات الخادم. حسابات التجربة: admin@demo.local / demo-admin (مدير ومعتمِد) و cashier@demo.local / demo-cashier (أمين صندوق).'
            : 'Browser-only demo: data never leaves this browser. Use the server edition for real work. Demo accounts: admin@demo.local / demo-admin (approver) and cashier@demo.local / demo-cashier.'}
        </p>
      )}
    </form>
  );
}

function Dashboard({ lang }: { lang: Lang }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => { api<Dash>(`/dashboard?from=${from}&to=${to}`).then(setD).catch(() => setD(null)); }, [from, to]);
  const L = (k: Key) => t(lang, k);
  if (!d) return <p>{L('none')}</p>;
  const neg = d.netProfit.startsWith('-');
  return (
    <>
      <div className="row">
        <label>{L('from')}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>{L('to')}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <div className="kpis">
        <div className="card kpi"><div className="label">{L('cash')}</div><div className="value">{fmt(d.cashAndBank.total, lang)}</div></div>
        <div className="card kpi"><div className="label">{L('income')}</div><div className="value positive">{fmt(d.income, lang)}</div></div>
        <div className="card kpi"><div className="label">{L('expenses')}</div><div className="value negative">{fmt(d.expenses, lang)}</div></div>
        <div className="card kpi"><div className="label">{L('net')}</div><div className={`value ${neg ? 'negative' : 'positive'}`}>{fmt(d.netProfit, lang)}</div></div>
        <div className="card kpi"><div className="label">{L('pending')}</div><div className="value">{d.pendingApprovals}</div></div>
      </div>
      <p style={{ color: 'var(--text-muted)' }}>{L('phase2')}</p>
      <div className="card">
        <h3>{L('latest')}</h3>
        <TxTable lang={lang} rows={d.latestTransactions} />
      </div>
    </>
  );
}

function TxTable({ lang, rows, actions }: { lang: Lang; rows: Tx[]; actions?: (t: Tx) => React.ReactNode }) {
  if (!rows.length) return <p>{t(lang, 'none')}</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead><tr>
          <th>{t(lang, 'ref')}</th><th>{t(lang, 'date')}</th><th>{t(lang, 'desc')}</th><th>{t(lang, 'kind')}</th><th>{t(lang, 'amount')}</th><th>{t(lang, 'status')}</th>{actions && <th />}
        </tr></thead>
        <tbody>{rows.map((x) => (
          <tr key={x.id}>
            <td>{x.reference}</td><td>{String(x.tx_date).slice(0, 10)}</td><td>{x.description}</td>
            <td>{t(lang, x.kind === 'income' ? 'incomeKind' : 'expenseKind')}</td>
            <td>{fmt(x.amount, lang)}</td><td>{t(lang, x.status as Key)}</td>
            {actions && <td>{actions(x)}</td>}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Transactions({ lang, user }: { lang: Lang; user: User }) {
  const [rows, setRows] = useState<Tx[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ kind: 'income', txDate: new Date().toISOString().slice(0, 10), description: '', categoryAccountId: '', cashAccountId: '', amount: '', documentNo: '' });
  const L = (k: Key) => t(lang, k);
  const load = useCallback(() => { api<Tx[]>('/transactions').then(setRows).catch(() => setRows([])); }, []);
  useEffect(() => { load(); api<Account[]>('/accounts').then(setAccounts).catch(() => {}); }, [load]);

  const cats = accounts.filter((a) => a.type === (f.kind === 'income' ? 'revenue' : 'expense') && !/^[1-5]000$/.test(a.code));
  const cashAccts = accounts.filter((a) => a.is_cash_or_bank);
  const name = (a: Account) => `${a.code} — ${lang === 'ar' ? a.name_ar : a.name_en}`;
  const act = async (path: string, body: unknown = {}) => {
    setErr('');
    try { await api(path, { method: 'POST', body }); load(); } catch (x) { setErr(x instanceof ApiError ? x.message : 'Error'); }
  };

  return (
    <>
      <form className="card row" onSubmit={async (e) => {
        e.preventDefault(); setErr('');
        try { await api('/transactions', { method: 'POST', body: { ...f, documentNo: f.documentNo || undefined } }); setF({ ...f, description: '', amount: '', documentNo: '' }); load(); }
        catch (x) { setErr(x instanceof ApiError ? x.message : 'Error'); }
      }}>
        <label>{L('kind')}<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, categoryAccountId: '' })}>
          <option value="income">{L('incomeKind')}</option><option value="expense">{L('expenseKind')}</option></select></label>
        <label>{L('date')}<input type="date" required value={f.txDate} onChange={(e) => setF({ ...f, txDate: e.target.value })} /></label>
        <label>{L('category')}<select required value={f.categoryAccountId} onChange={(e) => setF({ ...f, categoryAccountId: e.target.value })}>
          <option value="" />{cats.map((a) => <option key={a.id} value={a.id}>{name(a)}</option>)}</select></label>
        <label>{L('account')}<select required value={f.cashAccountId} onChange={(e) => setF({ ...f, cashAccountId: e.target.value })}>
          <option value="" />{cashAccts.map((a) => <option key={a.id} value={a.id}>{name(a)}</option>)}</select></label>
        <label>{L('amount')}<input required inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label>{L('docNo')}<input value={f.documentNo} onChange={(e) => setF({ ...f, documentNo: e.target.value })} /></label>
        <label style={{ flex: 1, minWidth: 200 }}>{L('desc')}<input required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <button className="btn accent">{L('save')}</button>
      </form>
      {err && <div className="error" role="alert">{err}</div>}
      <div className="card" style={{ marginTop: 16 }}>
        <TxTable lang={lang} rows={rows} actions={(x) => (
          <div className="row">
            {x.status === 'draft' && x.created_by === user.id && <button className="btn" onClick={() => act(`/transactions/${x.id}/submit`)}>{L('submit')}</button>}
            {x.status === 'pending_approval' && x.created_by !== user.id && (<>
              <button className="btn accent" onClick={() => act(`/transactions/${x.id}/approve`)}>{L('approve')}</button>
              <button className="btn" onClick={() => { const reason = prompt(L('reject')); if (reason) act(`/transactions/${x.id}/reject`, { reason }); }}>{L('reject')}</button>
            </>)}
          </div>
        )} />
      </div>
    </>
  );
}
