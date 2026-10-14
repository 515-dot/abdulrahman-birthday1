// Server-side RBAC. Every route must call can()/requirePermission(); hiding UI is never enough.
export const ROLES = ['super_admin', 'finance_manager', 'accountant', 'cashier', 'sales_manager', 'broker', 'auditor'];

const P = {
  super_admin: ['*'],
  finance_manager: ['accounts:read', 'accounts:write', 'tx:read', 'tx:create', 'tx:approve', 'journal:read', 'journal:post', 'journal:reverse', 'reports:read', 'reports:export', 'deals:read', 'audit:read'],
  accountant: ['accounts:read', 'tx:read', 'tx:create', 'journal:read', 'journal:create', 'reports:read', 'deals:read'],
  cashier: ['accounts:read', 'tx:read', 'tx:create'],
  sales_manager: ['deals:read', 'deals:write', 'reports:read'],
  broker: ['deals:read:own'],
  auditor: ['accounts:read', 'tx:read', 'journal:read', 'reports:read', 'audit:read', 'deals:read'],
};

export function can(role, permission) {
  const list = P[role] ?? [];
  return list.includes('*') || list.includes(permission);
}

/**
 * Separation of duties: the creator of a transaction can never approve it, and the approver's
 * limit (in minor units, null = unlimited) must cover the amount.
 */
export function canApprove({ role, userId, createdBy, amount, approvalLimit }) {
  if (!can(role, 'tx:approve')) return { ok: false, reason: 'Role cannot approve transactions' };
  if (userId === createdBy) return { ok: false, reason: 'Creator cannot approve their own transaction' };
  if (approvalLimit != null && amount > approvalLimit) return { ok: false, reason: 'Amount exceeds approval limit' };
  return { ok: true };
}
