'use client';
import { useState } from 'react';

export default function LeadForm() {
  const [error, setError] = useState('');
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const budget = Number(f.get('budget'));
    const res = await fetch('/api/leads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: f.get('fullName'), phone: f.get('phone') || undefined,
        budget: budget > 0 ? budget : undefined, notes: f.get('notes') || undefined,
      }),
    });
    if (res.ok) window.location.reload();
    else setError((await res.json().catch(() => ({}))).error ?? 'تعذر الحفظ');
  }
  const input = 'rounded-lg border border-line bg-white px-3 py-2';
  return (
    <form onSubmit={onSubmit} className="mb-4 grid gap-3 rounded-2xl border border-line bg-white p-5 md:grid-cols-4">
      <input name="fullName" required placeholder="اسم العميل" className={input} />
      <input name="phone" dir="ltr" placeholder="الهاتف" className={input} />
      <input name="budget" type="number" min="0" placeholder="الميزانية (EGP)" className={input} />
      <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-brown-900 hover:bg-brand-600">إضافة عميل محتمل</button>
      <input name="notes" placeholder="ملاحظات" className={`${input} md:col-span-4`} />
      {error && <p role="alert" className="text-sm text-red-700 md:col-span-4">{error}</p>}
    </form>
  );
}
