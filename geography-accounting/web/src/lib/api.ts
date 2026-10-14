export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (import.meta.env.VITE_STATIC) {
    // GitHub Pages build: no server, the same API contract is served by an in-browser backend.
    const { handle } = await import('./localBackend');
    return handle(path, init.method ?? 'GET', init.body) as T;
  }
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Request failed');
  return data as T;
}

// Amounts arrive as decimal strings ("1234.50"); they are only formatted for display, never summed in the browser.
export const fmt = (v: string, lang: 'ar' | 'en') =>
  new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v));
