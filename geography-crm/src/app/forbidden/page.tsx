export default function Forbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6 text-center">
      <div>
        <h1 className="mb-2 text-xl font-bold">ليس لديك صلاحية الوصول</h1>
        <p className="mb-4 text-brown">تواصل مع مدير النظام إذا كنت تحتاج هذه الصلاحية.</p>
        <a href="/login" className="text-steel underline">العودة</a>
      </div>
    </main>
  );
}
