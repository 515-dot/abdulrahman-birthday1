import Shell from '@/components/Shell';
import UserAdmin from '@/components/UserAdmin';
import { db } from '@/lib/db';
import { requirePage } from '@/lib/guard';

export default async function UsersPage() {
  const { user, principal } = await requirePage({ permission: 'users.create' });
  const [departments, roles, users] = await Promise.all([
    db.department.findMany({ orderBy: { nameEn: 'asc' } }),
    db.role.findMany({ orderBy: { nameEn: 'asc' } }),
    db.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true, fullName: true, email: true, status: true,
        department: { select: { nameAr: true } }, roles: { select: { role: { select: { nameAr: true } } } },
      },
      orderBy: { createdAt: 'desc' }, take: 200,
    }),
  ]);
  return (
    <Shell principal={principal} name={user.fullName} title="إدارة المستخدمين">
      <UserAdmin
        departments={departments.map((d) => ({ id: d.id, label: d.nameAr }))}
        roles={roles.map((r) => ({ id: r.id, label: r.nameAr }))}
        users={users.map((u) => ({
          id: u.id, fullName: u.fullName, email: u.email, status: u.status,
          dept: u.department?.nameAr ?? '—', roles: u.roles.map((r) => r.role.nameAr).join('، ') || '—',
        }))}
      />
    </Shell>
  );
}
