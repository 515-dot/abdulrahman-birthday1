// Development seed: reference data only (departments, roles, permissions, pipeline).
// No fake people, passwords, revenue or metrics are created. Create real accounts
// through the admin UI after `npm run setup:admin`.
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS } from '../src/lib/permissions';

const db = new PrismaClient();

const DEPARTMENTS = [
  ['ADMIN', 'الإدارة', 'Administration'],
  ['SALES', 'المبيعات', 'Sales'],
  ['MARKETING', 'التسويق', 'Marketing'],
  ['HR', 'الموارد البشرية', 'Human Resources'],
  ['CREATIVE', 'الاستوديو الإبداعي', 'Creative Studio'],
] as const;

const ROLES: Record<string, { ar: string; en: string; perms: string[] }> = {
  sales_agent: { ar: 'مندوب مبيعات', en: 'Sales Agent', perms: ['leads.view_own', 'leads.create', 'leads.update'] },
  sales_manager: {
    ar: 'مدير مبيعات', en: 'Sales Manager',
    perms: ['leads.view_own', 'leads.view_team', 'leads.create', 'leads.update', 'leads.assign', 'leads.export', 'sales.view_commissions'],
  },
  marketing: { ar: 'تسويق', en: 'Marketing', perms: ['marketing.view_campaigns'] },
  marketing_manager: { ar: 'مدير تسويق', en: 'Marketing Manager', perms: ['marketing.view_campaigns', 'marketing.manage_budgets'] },
  hr: { ar: 'موارد بشرية', en: 'HR', perms: ['hr.view_employee_records', 'hr.manage_attendance'] },
  designer: { ar: 'مصمم جرافيك', en: 'Graphic Designer', perms: ['creative.view_assigned_projects'] },
};

const STAGES = [
  ['new', 'عميل جديد', 'New Lead'], ['contacted', 'تم التواصل', 'Contacted'],
  ['qualified', 'مؤهل', 'Qualified'], ['meeting', 'اجتماع محدد', 'Meeting Scheduled'],
  ['presented', 'عرض العقار', 'Property Presented'], ['negotiation', 'تفاوض', 'Negotiation'],
  ['reservation', 'حجز', 'Reservation'], ['won', 'تم البيع', 'Won'], ['lost', 'خسارة', 'Lost'],
] as const;

async function main() {
  for (const [code, nameAr, nameEn] of DEPARTMENTS) {
    await db.department.upsert({ where: { code }, update: {}, create: { code, nameAr, nameEn } });
  }
  for (const key of PERMISSIONS) {
    await db.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
  for (const [code, r] of Object.entries(ROLES)) {
    const role = await db.role.upsert({
      where: { code }, update: {}, create: { code, nameAr: r.ar, nameEn: r.en, isSystem: true },
    });
    for (const key of r.perms) {
      const perm = await db.permission.findUniqueOrThrow({ where: { key } });
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {}, create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }
  for (const [i, [code, nameAr, nameEn]] of STAGES.entries()) {
    await db.pipelineStage.upsert({
      where: { code }, update: {},
      create: { code, nameAr, nameEn, position: i, isWon: code === 'won', isLost: code === 'lost' },
    });
  }
  console.log('Reference data seeded.');
}
main().finally(() => db.$disconnect());
