import { describe, it, expect } from 'vitest';
import { ROLES } from './roles';
import { PERMISSIONS, can, canViewLead, leadScopeWhere, canGrantPermissions, type Principal } from './permissions';

const as = (role: keyof typeof ROLES, o: Partial<Principal> = {}): Principal => ({
  id: 'u1', isSuperAdmin: false, status: 'ACTIVE', teamId: 't1', rolePermissions: ROLES[role].perms, grants: [], revokes: [], ...o,
});

describe('default roles only reference real permissions', () => {
  for (const [code, r] of Object.entries(ROLES)) {
    it(code, () => expect(r.perms.every((p) => (PERMISSIONS as readonly string[]).includes(p))).toBe(true));
  }
});

describe('restricted HR / finance data', () => {
  const SENSITIVE = ['hr.view_salary_records', 'hr.manage_payroll'] as const;
  for (const role of Object.keys(ROLES) as (keyof typeof ROLES)[]) {
    it(`${role} has no salary or payroll access by default`, () => {
      for (const k of SENSITIVE) expect(can(as(role), k)).toBe(false);
    });
  }
  it('sales roles cannot read HR records', () => {
    expect(can(as('sales_agent'), 'hr.view_employee_records')).toBe(false);
    expect(can(as('sales_manager'), 'hr.view_employee_records')).toBe(false);
  });
  it('marketing and designers cannot see leads or commissions', () => {
    for (const r of ['marketing', 'marketing_manager', 'designer'] as const) {
      expect(can(as(r), 'leads.view_own')).toBe(false);
      expect(can(as(r), 'sales.view_commissions')).toBe(false);
    }
  });
  it('designers cannot see marketing budgets or HR', () => {
    expect(can(as('designer'), 'marketing.manage_budgets')).toBe(false);
    expect(can(as('designer'), 'hr.view_employee_records')).toBe(false);
  });
});

describe('lead ownership', () => {
  const lead = { ownerId: 'other', ownerTeamId: 't1' };
  it('agent sees only own leads', () => {
    expect(canViewLead(as('sales_agent'), { ownerId: 'u1', ownerTeamId: 't1' })).toBe(true);
    expect(canViewLead(as('sales_agent'), lead)).toBe(false);
  });
  it('manager sees own team but not another team', () => {
    expect(canViewLead(as('sales_manager'), lead)).toBe(true);
    expect(canViewLead(as('sales_manager'), { ownerId: 'x', ownerTeamId: 't2' })).toBe(false);
  });
  it('roles without lead permissions match nothing in queries', () => {
    expect(leadScopeWhere(as('marketing'))).toEqual({ id: { in: [] } });
    expect(leadScopeWhere(as('hr'))).toEqual({ id: { in: [] } });
  });
});

describe('privilege escalation', () => {
  it('non-admin roles cannot grant permissions', () => {
    expect(canGrantPermissions(as('sales_manager'), ['leads.view_all'])).toBe(false);
    expect(canGrantPermissions(as('hr_manager'), ['hr.view_salary_records'])).toBe(false);
  });
  it('a manager holding roles.manage cannot grant what they lack', () => {
    const p = as('sales_manager', { grants: ['roles.manage'] });
    expect(canGrantPermissions(p, ['leads.assign'])).toBe(true);
    expect(canGrantPermissions(p, ['hr.view_salary_records'])).toBe(false);
  });
});
