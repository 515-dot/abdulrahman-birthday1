export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="Geography Real Estate" width={220} className="mx-auto mb-6" />
        <div className="mb-2 text-5xl font-bold text-brand">404</div>
        <h1 className="mb-2 text-xl font-bold">الصفحة غير موجودة</h1>
        <p className="mb-6 text-sm text-brown">الرابط الذي فتحته غير صحيح أو لم يعد متاحاً.</p>
        {/* "/" sends signed-in users to their workspace and everyone else to the login page. */}
        <a href="/" className="block rounded-xl bg-brand py-3 font-semibold text-brown-900 hover:bg-brand-600">
          العودة إلى الدخول
        </a>
        <a href="/login" className="mt-3 block text-sm text-steel underline">دخول الموظفين</a>
      </div>
    </main>
  );
}
