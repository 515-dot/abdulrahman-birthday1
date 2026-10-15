'use client';
import { useState } from 'react';

export default function ChangePassword() {
  const [error, setError] = useState('');
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('newPassword') !== f.get('confirm')) return setError('كلمتا المرور غير متطابقتين');
    const res = await fetch('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: f.get('currentPassword'), newPassword: f.get('newPassword') }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) window.location.href = data.redirect;
    else if (res.status === 401) window.location.href = '/login';
    else setError(data.error ?? 'تعذر تغيير كلمة المرور');
  }
  const input = 'w-full rounded-xl border border-line bg-white px-4 py-3';
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-white p-8">
        <h1 className="text-xl font-bold">تغيير كلمة المرور</h1>
        <p className="text-sm text-brown">يجب تغيير كلمة المرور المؤقتة قبل المتابعة (12 حرفاً على الأقل، حروف كبيرة وصغيرة ورقم).</p>
        <input name="currentPassword" type="password" required dir="ltr" autoComplete="current-password" placeholder="كلمة المرور الحالية" className={input} />
        <input name="newPassword" type="password" required dir="ltr" autoComplete="new-password" placeholder="كلمة المرور الجديدة" className={input} />
        <input name="confirm" type="password" required dir="ltr" autoComplete="new-password" placeholder="تأكيد كلمة المرور" className={input} />
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="w-full rounded-xl bg-brand py-3 font-semibold text-brown-900 hover:bg-brand-600">حفظ</button>
      </form>
    </main>
  );
}
