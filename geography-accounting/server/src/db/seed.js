// Seeds the default chart of accounts (structural, editable) and ONE initial admin user.
// No demo transactions are created. The accountant must review the chart before real use.
import argon2 from 'argon2';
import { pool } from './pool.js';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 12 chars) in the environment before seeding.');
  process.exit(1);
}

// code, Arabic, English, type, is_cash_or_bank
const COA = [
  ['1000', 'الأصول', 'Assets', 'asset', false],
  ['1010', 'الصندوق', 'Cash on Hand', 'asset', true],
  ['1020', 'البنك الرئيسي', 'Main Bank Account', 'asset', true],
  ['1100', 'العملاء (مدينون)', 'Accounts Receivable', 'asset', false],
  ['2000', 'الخصوم', 'Liabilities', 'liability', false],
  ['2100', 'الموردون (دائنون)', 'Accounts Payable', 'liability', false],
  ['2200', 'عمولات السماسرة المستحقة', 'Broker Commissions Payable', 'liability', false],
  ['2300', 'حسابات الضرائب', 'Tax Accounts', 'liability', false],
  ['3000', 'حقوق الملكية', 'Equity', 'equity', false],
  ['3100', 'رأس المال / مساهمات الملاك', 'Owner Contributions', 'equity', false],
  ['3200', 'مسحوبات الملاك', 'Owner Withdrawals', 'equity', false],
  ['4000', 'الإيرادات', 'Revenue', 'revenue', false],
  ['4100', 'إيرادات عمولات الوساطة', 'Commission Revenue', 'revenue', false],
  ['4900', 'إيرادات أخرى', 'Other Income', 'revenue', false],
  ['5000', 'المصروفات', 'Expenses', 'expense', false],
  ['5100', 'الرواتب', 'Salaries', 'expense', false],
  ['5200', 'إيجار المكتب', 'Office Rent', 'expense', false],
  ['5300', 'التسويق والإعلان', 'Marketing & Advertising', 'expense', false],
  ['5400', 'المواصلات', 'Transportation', 'expense', false],
  ['5500', 'المرافق', 'Utilities', 'expense', false],
  ['5600', 'اشتراكات البرامج', 'Software Subscriptions', 'expense', false],
  ['5700', 'مستلزمات المكتب', 'Office Supplies', 'expense', false],
  ['5800', 'خدمات مهنية', 'Professional Services', 'expense', false],
  ['5900', 'عمولات السماسرة', 'Broker Commission Expense', 'expense', false],
  ['5990', 'مصروفات أخرى معتمدة', 'Other Approved Expenses', 'expense', false],
];

const hash = await argon2.hash(password, { type: argon2.argon2id });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const [code, ar, en, type, cash] of COA) {
    await client.query(
      'INSERT INTO accounts (code, name_ar, name_en, type, is_cash_or_bank) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO NOTHING',
      [code, ar, en, type, cash],
    );
  }
  await client.query(
    `INSERT INTO users (email, full_name, password_hash, role) VALUES ($1,'Administrator',$2,'super_admin') ON CONFLICT (email) DO NOTHING`,
    [email.toLowerCase(), hash],
  );
  await client.query('COMMIT');
  console.log('Seeded chart of accounts and admin user', email);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
  await pool.end();
}
