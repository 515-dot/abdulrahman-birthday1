import './globals.css';
import type { ReactNode } from 'react';

export const metadata = { title: 'Geography Real Estate — CRM' };

// Arabic RTL is the default. A language switcher will set a `lang` cookie read here.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
