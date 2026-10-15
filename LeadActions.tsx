'use client';
import { useState } from 'react';

type Stage = { id: string; label: string };
const TYPES: [string, string][] = [
  ['CALL', 'مكالمة'], ['MEETING', 'اجتماع'], ['WHATSAPP', 'واتساب'], ['EMAIL', 'بريد'], ['NOTE', 'ملاحظة'], ['FOLLOW_UP', 'متابعة'],
];

export default function LeadActions({ leadId, stages, stageId }: { leadId: string; stages: Stage[]; stageId: string }) {
  const [error, setError] = useState('');

  async function call(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) window.location.reload();
    else setError((await res.json().catch(() => ({}))).error ?? 'تعذر التنفيذ');
  }

  async function addActivity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const due = f.get('dueAt') as string;
    await call(`/api/leads/${leadId}/activities`, 'POST', {
      type: f.get('type'), summary: f.get('summary'), dueAt: due ? new Date(due).toISOString() : undefined,
    });
  }

  const input = 'rounded-lg border border-line bg-white px-3 py-2';
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block text-brown">المرحلة</span>
        <select defaultValue={stageId} className={input} onChange={(e) => call(`/api/leads/${leadId}`, 'PATCH', { stageId: e.target.value })}>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <form onSubmit={addActivity} className="grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-4">
        <select name="type" className={input}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input name="summary" required placeholder="التفاصيل" className={`${input} md:col-span-2`} />
        <input name="dueAt" type="datetime-local" className={input} title="موعد المتابعة (اختياري)" />
        <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-brown-900 hover:bg-brand-600 md:col-span-4">تسجيل نشاط</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
