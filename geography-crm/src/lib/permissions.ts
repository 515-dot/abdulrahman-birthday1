// Centralized permission engine. Pure functions: no DB or framework imports,
// so the logic is unit-testable and shared by every server endpoint.

export const PERMISSIONS = [
  'leads.view_own', 'leads.view_team', 'leads.view_all',
  'leads.create', 'leads.update', 'leads.assign', 'leads.export',
  'sales.view_commissions',
  'marketing.view_campaigns', 'marketing.manage_budgets',
  'hr.view_employee_records', 'hr.view_salary_records', 'hr.manage_attendance',
  'creative.view_assigned_projects', 'creative.approve_deliverables',
  'users.create', 'roles.manage', 'settings.manage', 'audit_logs.view',
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export interface Principal {
  id: string;
  isSuperAdmin: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  teamId: string | null;
  rolePermissions: readonly string[]; // union across the user's roles
  grants: readonly string[];          // per-user explicit grants
  revokes: readonly string[];         // per-user explicit revocations
}

/** Effective permission = (role perms + grants) − revokes. Inactive accounts have none. */
export function can(p: Principal, key: PermissionKey): boolean {
  if (p.status !== 'ACTIVE') return false;
  if (p.revokes.includes(key)) return false;
  if (p.isSuperAdmin) return true;
  return p.rolePermissions.includes(key) || p.grants.includes(key);
}

export class ForbiddenError extends Error {
  constructor(key: string) {
    super(`Forbidden: ${key}`);
    this.name = 'ForbiddenError';
  }
}

export function assertCan(p: Principal, key: PermissionKey): void {
  if (!can(p, key)) throw new ForbiddenError(key);
}

export interface LeadRecord { ownerId: string | null; ownerTeamId: string | null }

/** Record-level policy for leads: view_all > view_team > view_own. */
export function canViewLead(p: Principal, lead: LeadRecord): boolean {
  if (can(p, 'leads.view_all')) return true;
  if (can(p, 'leads.view_team') && p.teamId && lead.ownerTeamId === p.teamId) return true;
  if (can(p, 'leads.view_own') && lead.ownerId === p.id) return true;
  return false;
}

/** Prisma `where` fragment so list queries are filtered in the database, not in the UI. */
export function leadScopeWhere(p: Principal): Record<string, unknown> {
  if (can(p, 'leads.view_all')) return { deletedAt: null };
  const or: Record<string, unknown>[] = [];
  if (can(p, 'leads.view_team') && p.teamId) or.push({ owner: { teamId: p.teamId } });
  if (can(p, 'leads.view_own')) or.push({ ownerId: p.id });
  // No applicable permission → match nothing.
  return or.length ? { deletedAt: null, OR: or } : { id: { in: [] } };
}

/**
 * Privilege-escalation guard: an actor may only grant permissions they hold
 * themselves, and only a Super Admin may create or edit Super Admins.
 */
export function canGrantPermissions(actor: Principal, requested: readonly string[]): boolean {
  if (!can(actor, 'roles.manage')) return false;
  if (actor.isSuperAdmin) return true;
  return requested.every((k) => can(actor, k as PermissionKey));
}

export function canManageSuperAdminFlag(actor: Principal): boolean {
  return actor.status === 'ACTIVE' && actor.isSuperAdmin;
}
