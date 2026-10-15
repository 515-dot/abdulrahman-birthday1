import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { workspaceFor } from '@/lib/workspace';

// Always evaluated per request: the destination depends on the visitor's session.
export const dynamic = 'force-dynamic';

/**
 * `/` never renders protected content. Visitors with a valid session go to their own
 * workspace (or the forced password change); everyone else goes to the admin login.
 * Authorization is still enforced by each destination page and API route.
 */
export default async function Home() {
  let session = null;
  try {
    session = await getSessionUser();
  } catch {
    // Missing SESSION_SECRET or database unreachable: treat as signed out; the login page reports real errors.
  }
  if (session) redirect(session.user.mustChangePassword ? '/change-password' : workspaceFor(session.user));
  redirect('/admin/login');
}
