import { describe, it, expect } from 'vitest';
import {
  can, assertCan, canViewLead, leadScopeWhere, canGrantPermissions,
  canManageSuperAdminFlag, ForbiddenError, type Principal,
} from './permissions';

const base: Principal = {
  id: 'u1', isSuperAdmin: false, status: 'ACTIVE', teamId: 't1',
  rolePermissions: [], grants: [], revokes: [],
};
const mk = (o: Partial<Principal>): Principal => ({ ...base, ...o });

describe('can()', () => {
  it('denies by default', () => expect(can(base, 'leads.view_all')).toBe(false));
  it('allows role permissions', () =>
    expect(can(mk({ rolePermissions: ['leads.create'] }), 'leads.create')).toBe(true));
  it('allows explicit user grants', () =>
    expect(can(mk({ grants: ['leads.export'] }), 'leads.export')).toBe(true));
  it('explicit revoke beats a role permission', () =>
    expect(can(mk({ rolePermissions: ['leads.export'], revokes: ['leads.export'] }), 'leads.export')).toBe(false));
  it('suspended and deactivated accounts have no permissions, even Super Admin', () => {
    expect(can(mk({ status: 'SUSPENDED', isSuperAdmin: true }), 'users.create')).toBe(false);
    expect(can(mk({ status: 'DEACTIVATED', rolePermissions: ['leads.create'] }), 'leads.create')).toBe(false);
  });
  it('super admin has everything', () =>
    expect(can(mk({ isSuperAdmin: true }), 'audit_logs.view')).toBe(true));
  it('assertCan throws ForbiddenError', () =>
    expect(() => assertCan(base, 'hr.view_salary_records')).toThrow(ForbiddenError));
});

describe('department separation', () => {
  const sales = mk({ rolePermissions: ['leads.view_own', 'leads.create', 'leads.update'] });
  const marketing = mk({ rolePermissions: ['marketing.view_campaigns'] });
  const designer = mk({ rolePermissions: ['creative.view_assigned_projects'] });
  it('sales cannot read salaries or HR records', () => {
    expect(can(sales, 'hr.view_salary_records')).toBe(false);
    expect(can(sales, 'hr.view_employee_records')).toBe(false);
  });
  it('marketing cannot view commissions', () =>
    expect(can(marketing, 'sales.view_commissions')).toBe(false));
  it('designer cannot see leads or HR', () => {
    expect(can(designer, 'leads.view_own')).toBe(false);
    expect(can(designer, 'hr.view_employee_records')).toBe(false);
  });
});

describe('lead record-level access', () => {
  const agent = mk({ id: 'a', rolePermissions: ['leads.view_own'] });
  const manager = mk({ id: 'm', teamId: 't1', rolePermissions: ['leads.view_team'] });
  it('agent sees only own leads', () => {
    expect(canViewLead(agent, { ownerId: 'a', ownerTeamId: 't1' })).toBe(true);
    expect(canViewLead(agent, { ownerId: 'b', ownerTeamId: 't1' })).toBe(false);
  });
  it('manager sees own team but not other teams', () => {
    expect(canViewLead(manager, { ownerId: 'x', ownerTeamId: 't1' })).toBe(true);
    expect(canViewLead(manager, { ownerId: 'y', ownerTeamId: 't2' })).toBe(false);
  });
  it('list scope matches nothing without any lead permission', () =>
    expect(leadScopeWhere(base)).toEqual({ id: { in: [] } }));
  it('list scope for an agent filters by owner', () =>
    expect(leadScopeWhere(agent)).toEqual({ deletedAt: null, OR: [{ ownerId: 'a' }] }));
});

describe('privilege escalation', () => {
  const admin = mk({ rolePermissions: ['roles.manage', 'leads.view_own'] });
  it('cannot grant a permission the actor lacks', () =>
    expect(canGrantPermissions(admin, ['hr.view_salary_records'])).toBe(false));
  it('can grant permissions the actor holds', () =>
    expect(canGrantPermissions(admin, ['leads.view_own'])).toBe(true));
  it('needs roles.manage at all', () =>
    expect(canGrantPermissions(base, ['leads.view_own'])).toBe(false));
  it('only super admin may manage the super admin flag', () => {
    expect(canManageSuperAdminFlag(admin)).toBe(false);
    expect(canManageSuperAdminFlag(mk({ isSuperAdmin: true }))).toBe(true);
  });
});
