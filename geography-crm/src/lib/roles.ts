// Default system roles (single source of truth for the seed and the access-matrix tests).
export const ROLES: Record<string, { ar: string; en: string; perms: string[] }> = {
  sales_agent: { ar: 'مندوب مبيعات', en: 'Sales Agent', perms: ['leads.view_own', 'leads.create', 'leads.update'] },
  sales_manager: {
    ar: 'مدير مبيعات', en: 'Sales Manager',
    perms: ['leads.view_own', 'leads.view_team', 'leads.create', 'leads.update', 'leads.assign', 'leads.export', 'sales.view_commissions', 'properties.manage'],
  },
  marketing: { ar: 'تسويق', en: 'Marketing', perms: ['marketing.view_campaigns'] },
  marketing_manager: { ar: 'مدير تسويق', en: 'Marketing Manager', perms: ['marketing.view_campaigns', 'marketing.manage_budgets'] },
  hr: { ar: 'موارد بشرية', en: 'HR', perms: ['hr.view_employee_records', 'hr.manage_attendance'] },
  hr_manager: { ar: 'مدير موارد بشرية', en: 'HR Manager', perms: ['hr.view_employee_records', 'hr.manage_attendance', 'hr.manage_recruitment', 'hr.manage_performance'] },
  designer: { ar: 'مصمم جرافيك', en: 'Graphic Designer', perms: ['creative.view_assigned_projects'] },
};
