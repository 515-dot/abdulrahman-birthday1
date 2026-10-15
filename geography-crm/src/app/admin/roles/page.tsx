import Shell from '@/components/Shell';
import RoleEditor from '@/components/RoleEditor';
import { db } from '@/lib/db';
import { requirePage } from '@/lib/guard';
import { PERMISSIONS } from '@/lib/permissions';

export default async function RolesPage() {
  const { user, principal } = await requirePage({ permission: 'roles.manage' });
  const roles = await db.role.findMany({
    orderBy: { nameEn: 'asc' },
    include: { permissions: { include: { permission: true } } },
  });
  return (
    <Shell principal={principal} name={user.fullName} title="الأدوار والصلاحيات">
      <RoleEditor
        allKeys={[...PERMISSIONS]}
        roles={roles.map((r) => ({ id: r.id, name: `${r.nameAr} (${r.code})`, keys: r.permissions.map((p) => p.permission.key) }))}
      />
    </Shell>
  );
}
