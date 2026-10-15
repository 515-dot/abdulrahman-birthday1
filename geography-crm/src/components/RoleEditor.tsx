'use client';
import { useState } from 'react';

type Role = { id: string; name: string; keys: string[] };

export default function RoleEditor({ roles, allKeys }: { roles: Role[]; allKeys: string[] }) {
  const [state, setState] = useState<Record<string, Set<string>>>(
    Object.fromEntries(roles.map((r) => [r.id, new Set(r.keys)])),
  );
  const [msg, setMsg] = useState<Record<string, string>>({});

  const toggle = (rid: string, key: string) =>
    setState((s) => {
      const next = new Set(s[rid]);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...s, [rid]: next };
    });

  async function save(rid: string) {
    const res = await fetch(`/api/roles/${rid}/permissions`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissionKeys: [...state[rid]] }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg((m) => ({ ...m, [rid]: res.ok ? 'تم الحفظ' : data.error ?? 'تعذر الحفظ' }));
  }

  const groups = [...new Set(allKeys.map((k) => k.split('.')[0]))];
  return (
    <div className="space-y-6">
      {roles.map((r) => (
        <section key={r.id} className="rounded-2xl border border-line bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{r.name}</h2>
            <div className="flex items-center gap-3 text-sm">
              {msg[r.id] && <span role="status" className="text-brown">{msg[r.id]}</span>}
              <button onClick={() => save(r.id)} className="rounded-lg bg-brand px-4 py-1.5 font-semibold text-brown-900 hover:bg-brand-600">حفظ</button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {groups.map((g) => (
              <fieldset key={g}>
                <legend className="mb-1 text-sm font-semibold text-brown">{g}</legend>
                {allKeys.filter((k) => k.startsWith(g + '.')).map((k) => (
                  <label key={k} className="flex items-center gap-2 py-0.5 text-sm" dir="ltr">
                    <input type="checkbox" checked={state[r.id].has(k)} onChange={() => toggle(r.id, k)} /> {k}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
