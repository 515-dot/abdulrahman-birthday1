// Role code → landing workspace. The role comes from the database, never from the login form.
const BY_ROLE: Record<string, string> = {
  // Managers land on the same page as their team; what they see is widened by permissions
  // (leads.view_team, marketing.manage_budgets), not by a separate route.
  sales_manager: '/sales',
  sales_agent: '/sales',
  marketing_manager: '/marketing',
  marketing: '/marketing',
  hr: '/hr',
  designer: '/creative',
};

export function workspaceFor(user: { isSuperAdmin: boolean; roles: { role: { code: string } }[] }): string {
  if (user.isSuperAdmin) return '/admin';
  // Most specific (manager) roles listed first in BY_ROLE take priority.
  for (const code of Object.keys(BY_ROLE)) {
    if (user.roles.some((r) => r.role.code === code)) return BY_ROLE[code];
  }
  return '/no-workspace'; // account exists but has no role yet
}
