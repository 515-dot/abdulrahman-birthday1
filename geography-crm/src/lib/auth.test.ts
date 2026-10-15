import { describe, it, expect, vi, beforeEach } from 'vitest';

// Session layer is mocked so these tests need neither a database nor cookies.
const getSessionUser = vi.fn();
vi.mock('./session', () => ({ getSessionUser: (...a: unknown[]) => getSessionUser(...a) }));

import { requireUser, assertSameOrigin, HttpError } from './auth';
import { ForbiddenError } from './permissions';

const sessionUser = (o: Record<string, unknown> = {}) => ({
  session: { id: 's1' },
  user: { id: 'u1', isSuperAdmin: false, status: 'ACTIVE', teamId: null, mustChangePassword: false, roles: [], permissionGrants: [], ...o },
});

beforeEach(() => getSessionUser.mockReset());

describe('requireUser', () => {
  it('rejects anonymous callers with 401', async () => {
    getSessionUser.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it('forces a password change before anything else (428)', async () => {
    getSessionUser.mockResolvedValue(sessionUser({ mustChangePassword: true }));
    await expect(requireUser()).rejects.toMatchObject({ status: 428 });
  });
  it('allows the password-change endpoint itself', async () => {
    getSessionUser.mockResolvedValue(sessionUser({ mustChangePassword: true }));
    await expect(requireUser({ allowPasswordChange: true })).resolves.toBeTruthy();
  });
  it('denies a user lacking the permission', async () => {
    getSessionUser.mockResolvedValue(sessionUser());
    await expect(requireUser({ permission: 'hr.view_salary_records' })).rejects.toBeInstanceOf(ForbiddenError);
  });
  it('a role permission grants access', async () => {
    getSessionUser.mockResolvedValue(sessionUser({ roles: [{ role: { permissions: [{ permission: { key: 'leads.view_own' } }] } }] }));
    await expect(requireUser({ permission: 'leads.view_own' })).resolves.toBeTruthy();
  });
  it('a per-user revoke beats the role permission', async () => {
    getSessionUser.mockResolvedValue(sessionUser({
      roles: [{ role: { permissions: [{ permission: { key: 'leads.export' } }] } }],
      permissionGrants: [{ granted: false, permission: { key: 'leads.export' } }],
    }));
    await expect(requireUser({ permission: 'leads.export' })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('assertSameOrigin (CSRF)', () => {
  const req = (h: Record<string, string>) => new Request('https://crm.example.com/api/x', { method: 'POST', headers: h });
  it('accepts same-origin', () => expect(() => assertSameOrigin(req({ origin: 'https://crm.example.com', host: 'crm.example.com' }))).not.toThrow());
  it('rejects a foreign origin', () => expect(() => assertSameOrigin(req({ origin: 'https://evil.test', host: 'crm.example.com' }))).toThrow(HttpError));
  it('rejects a missing origin', () => expect(() => assertSameOrigin(req({ host: 'crm.example.com' }))).toThrow(HttpError));
});
