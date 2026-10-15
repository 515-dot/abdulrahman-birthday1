'use client';
import { useState } from 'react';

type Opt = { id: string; label: string };
type Row = { id: string; fullName: string; email: string; status: string; dept: string; roles: string };

export default function UserAdmin({ departments, roles, users }: { departments: Opt[]; roles: Opt[]; users: Row[] }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tempPw, setTempPw] = useState<string | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: f.get('fullName'), email: f.get('email'), departmentId: f.get('departmentId'),
        jobTitle: f.get('jobTitle') || undefined, roleIds: [f.get('roleId')],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setTempPw(data.temporaryPassword); setMsg({ ok: true, text: `تم إنشاء الحساب ${data.email}` }); }
    else setMsg({ ok: false, text: data.error ?? 'تعذر إنشاء الحساب' });
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/users/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    if (res.ok) window.location.reload(); else setMsg({ ok: false, text: (await res.json()).error ?? 'فشل' });
  }

  async function resetPw(id: string, email: string) {
    if (!confirm(`إعادة تعيين كلمة مرور ${email}؟ سيتم إنهاء جلساته الحالية.`)) return;
    const res = await fetch(`/api/users/${id}/reset-password`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setTempPw(data.temporaryPassword); setMsg({ ok: true, text: `تمت إعادة تعيين كلمة مرور ${email}` }); }
    else setMsg({ ok: false, text: data.error ?? 'تعذر إعادة التعيين' });
  }

  const input = 'w-full rounded-lg border border-line bg-white px-3 py-2';
  return (
    <div className="space-y-6">
      <form onSubmit={create} className="grid gap-3 rounded-2xl border border-line bg-white p-5 md:grid-cols-3">
        <input name="fullName" required placeholder="الاسم الكامل" className={input} />
        <input name="email" type="email" required dir="ltr" placeholder="name@company" className={input} />
        <input name="jobTitle" placeholder="المسمى الوظيفي" className={input} />
        <select name="departmentId" required className={input}>
          <option value="">القسم</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <select name="roleId" required className={input}>
          <option value="">الدور</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-brown-900 hover:bg-brand-600">إنشاء حساب</button>
      </form>

      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      {tempPw && (
        <div className="rounded-lg border border-brand bg-brand-50 p-4 text-sm">
          كلمة المرور المؤقتة (تظهر مرة واحدة فقط، وسيُطلب تغييرها عند أول دخول):
          <code dir="ltr" className="ms-2 select-all font-mono">{tempPw}</code>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-start text-sm">
          <thead className="bg-surface text-brown"><tr>
            {['الاسم', 'البريد', 'القسم', 'الدور', 'الحالة', ''].map((h) => <th key={h} className="px-4 py-3 text-start">{h}</th>)}
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-3">{u.fullName}</td>
                <td className="px-4 py-3" dir="ltr">{u.email}</td>
                <td className="px-4 py-3">{u.dept}</td>
                <td className="px-4 py-3">{u.roles}</td>
                <td className="px-4 py-3">{u.status}</td>
                <td className="px-4 py-3">
                  {u.status === 'ACTIVE'
                    ? <button onClick={() => setStatus(u.id, 'SUSPENDED')} className="text-red-700 underline">إيقاف</button>
                    : <button onClick={() => setStatus(u.id, 'ACTIVE')} className="text-steel underline">تفعيل</button>}
                  <button onClick={() => resetPw(u.id, u.email)} className="ms-3 text-steel underline">إعادة تعيين كلمة المرور</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-brown">لا يوجد مستخدمون بعد.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
