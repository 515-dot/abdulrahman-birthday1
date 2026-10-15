import LoginForm from '@/components/LoginForm';

export default function AdminLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="Geography Real Estate" width={240} className="mx-auto mb-6" />
        <h1 className="mb-1 text-center text-xl font-bold">دخول مدير النظام</h1>
        <p className="mb-6 text-center text-sm text-brown">منطقة إدارية مؤمّنة</p>
        <LoginForm portal="admin" />
        <p className="mt-6 text-center text-sm"><a href="/login" className="text-steel underline">دخول الموظفين</a></p>
      </div>
    </main>
  );
}
