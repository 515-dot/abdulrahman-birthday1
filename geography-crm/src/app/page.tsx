export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface p-6">
      <div className="text-center space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="Geography Real Estate" width={280} className="mx-auto" />
        <p className="text-brown">منصة إدارة العلاقات العقارية — قيد الإنشاء</p>
      </div>
    </main>
  );
}
