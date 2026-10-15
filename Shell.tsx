import type { ReactNode } from 'react';
import { can, type PermissionKey, type Principal } from '@/lib/permissions';
import LogoutButton from './LogoutButton';

type Item = { href: string; label: string; permission?: PermissionKey; superAdmin?: boolean };

const NAV: Item[] = [
  { href: '/admin', label: 'لوحة الإدارة', superAdmin: true },
  { href: '/admin/users', label: 'المستخدمون', permission: 'users.create' },
  { href: '/admin/roles', label: 'الأدوار والصلاحيات', permission: 'roles.manage' },
  { href: '/admin/audit', label: 'سجل التدقيق', permission: 'audit_logs.view' },
  { href: '/sales', label: 'المبيعات', permission: 'leads.view_own' },
  { href: '/marketing', label: 'التسويق', permission: 'marketing.view_campaigns' },
  { href: '/hr', label: 'الموارد البشرية', permission: 'hr.view_employee_records' },
  { href: '/creative', label: 'الاستوديو الإبداعي', permission: 'creative.view_assigned_projects' },
];

// The sidebar only hides links; every page and API route enforces access again on the server.
export default function Shell({ principal, name, title, children }: {
  principal: Principal; name: string; title: string; children: ReactNode;
}) {
  const items = NAV.filter((i) => (i.superAdmin ? principal.isSuperAdmin : i.permission ? can(principal, i.permission) : true));
  return (
    <div className="min-h-screen bg-surface md:flex">
      <aside className="border-line bg-white p-4 md:min-h-screen md:w-64 md:border-e">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="Geography Real Estate" width={180} className="mb-6" />
        <nav className="flex gap-2 overflow-x-auto md:flex-col" aria-label="التنقل الرئيسي">
          {items.map((i) => (
            <a key={i.href} href={i.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-brown hover:bg-brand-50">{i.label}</a>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-line bg-white px-6 py-3">
          <h1 className="text-lg font-bold">{title}</h1>
          <div className="flex items-center gap-4 text-sm text-brown"><span>{name}</span><LogoutButton /></div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
