'use client';

export default function LogoutButton() {
  return (
    <button
      className="rounded-lg border border-line px-3 py-1 hover:bg-brand-50"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
      }}
    >
      تسجيل الخروج
    </button>
  );
}
