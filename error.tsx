'use client';

// Generic fallback: shows no technical details to visitors.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-bold">حدث خطأ غير متوقع</h1>
        <p className="mb-6 text-sm text-brown">حاول مرة أخرى، وإن استمرت المشكلة فأبلغ مدير النظام.</p>
        <button onClick={reset} className="w-full rounded-xl bg-brand py-3 font-semibold text-brown-900 hover:bg-brand-600">
          إعادة المحاولة
        </button>
      </div>
    </main>
  );
}
