import { redirect } from 'next/navigation';
import { getSessionUser } from './session';
import { toPrincipal } from './auth';
import { can, type PermissionKey } from './permissions';

/**
 * Server-side page guard. The page never renders (and never queries data) for a
 * user who fails these checks; hiding links in the sidebar is only cosmetic.
 */
export async function requirePage(opts: { permission?: PermissionKey; superAdmin?: boolean; loginPath?: string } = {}) {
  const s = await getSessionUser();
  if (!s) redirect(opts.loginPath ?? '/login');
  if (s.user.mustChangePassword) redirect('/change-password');
  if (opts.superAdmin && !s.user.isSuperAdmin) redirect('/forbidden');
  const principal = toPrincipal(s.user);
  if (opts.permission && !can(principal, opts.permission)) redirect('/forbidden');
  return { user: s.user, principal };
}
