'use client';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginForm({ portal }: { portal: 'admin' | 'employee' }) {
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError('');
    const f = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: f.get('email'), password: f.get('password'), portal, remember: f.get('remember') === 'on',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { window.location.href = data.redirect; return; }
    setError(res.status === 429 ? 'محاولات كثيرة، حاول لاحقاً' : 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
    setBusy(false);
  }

  const input = 'w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30';
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <label className="block">
        <span className="mb-1 block text-sm text-brown">البريد الإلكتروني</span>
        <input name="email" type="email" autoComplete="username" required dir="ltr" className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-brown">كلمة المرور</span>
        <div className="relative">
          <input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required dir="ltr" className={input} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-brown">
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      <label className="flex items-center gap-2 text-sm text-brown">
        <input name="remember" type="checkbox" /> تذكرني
      </label>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-brand py-3 font-semibold text-brown-900 hover:bg-brand-600 disabled:opacity-60">
        {busy ? '...' : 'تسجيل الدخول'}
      </button>
    </form>
  );
}
