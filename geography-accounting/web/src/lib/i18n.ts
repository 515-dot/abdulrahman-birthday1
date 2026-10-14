export type Lang = 'ar' | 'en';

const dict = {
  ar: {
    app: 'النظام المحاسبي', login: 'تسجيل الدخول', email: 'البريد الإلكتروني', password: 'كلمة المرور', logout: 'خروج',
    dashboard: 'لوحة المؤشرات', transactions: 'الإيرادات والمصروفات', cash: 'النقدية والبنوك', income: 'الإيرادات', expenses: 'المصروفات',
    net: 'صافي الربح / الخسارة', pending: 'بانتظار الاعتماد', latest: 'آخر المعاملات', from: 'من', to: 'إلى',
    new: 'معاملة جديدة', kind: 'النوع', incomeKind: 'إيراد', expenseKind: 'مصروف', date: 'التاريخ', desc: 'الوصف', category: 'التصنيف',
    account: 'حساب النقدية', amount: 'المبلغ', docNo: 'رقم المستند', save: 'حفظ كمسودة', submit: 'إرسال للاعتماد', approve: 'اعتماد', reject: 'رفض',
    status: 'الحالة', ref: 'المرجع', none: 'لا توجد بيانات بعد', draft: 'مسودة', pending_approval: 'بانتظار الاعتماد', posted: 'مرحّل', rejected: 'مرفوض', approved: 'معتمد',
    phase2: 'المستحقات والالتزامات والعمولات تظهر بعد المرحلة الثانية.',
  },
  en: {
    app: 'Accounting System', login: 'Sign in', email: 'Email', password: 'Password', logout: 'Sign out',
    dashboard: 'Dashboard', transactions: 'Income & Expenses', cash: 'Cash & Bank', income: 'Income', expenses: 'Expenses',
    net: 'Net profit / loss', pending: 'Pending approval', latest: 'Latest transactions', from: 'From', to: 'To',
    new: 'New transaction', kind: 'Type', incomeKind: 'Income', expenseKind: 'Expense', date: 'Date', desc: 'Description', category: 'Category',
    account: 'Cash account', amount: 'Amount', docNo: 'Document no.', save: 'Save draft', submit: 'Submit for approval', approve: 'Approve', reject: 'Reject',
    status: 'Status', ref: 'Reference', none: 'No data yet', draft: 'Draft', pending_approval: 'Pending approval', posted: 'Posted', rejected: 'Rejected', approved: 'Approved',
    phase2: 'Receivables, payables and commissions arrive in Phase 2.',
  },
} as const;

export type Key = keyof (typeof dict)['ar'];
export const t = (lang: Lang, k: Key) => dict[lang][k];
