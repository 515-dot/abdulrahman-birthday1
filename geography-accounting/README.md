# Geography Real Estate — Accounting System (Phase 1)

> **Status:** the pure accounting logic has 11 passing unit tests, and the 3 SQL migrations plus the posting flow
> and immutability triggers were run against PostgreSQL 16. **Not yet run end-to-end:** `npm install`, the frontend build
> and the HTTP routes (the packaging environment had no npm access). Run the checklist below once before going live.

## النشر (Deployment)

```bash
cp .env.example .env            # fill DB_PASSWORD and SESSION_SECRET (openssl rand -hex 32)
docker compose up -d --build    # builds the UI, applies migrations, starts app + PostgreSQL on 127.0.0.1:4000

# one-time: create the chart of accounts and the first Super Admin
docker compose run --rm -e ADMIN_EMAIL=you@company.com -e ADMIN_PASSWORD='a-long-unique-password' app node src/db/seed.js
```

Put an HTTPS reverse proxy (Caddy, Nginx, or your host's load balancer) in front of port 4000. **HTTPS is mandatory**:
in production the session cookie is `Secure`, so login will not work over plain HTTP.
Without Docker: `cd web && npm ci && npm run build`, then `cd server && npm ci --omit=dev && npm run migrate && NODE_ENV=production npm start`
(the server serves `web/dist` automatically). For managed PostgreSQL that requires TLS set `DATABASE_SSL=true`.

## موقع على GitHub Pages (نسخة تجريبية داخل المتصفح)

1. أنشئ مستودعاً على GitHub وارفع محتوى هذا المجلد إلى فرع `main`.
2. في المستودع: Settings ← Pages ← Source: **GitHub Actions**.
3. أول push يشغّل `.github/workflows/pages.yml` فيبني الموقع وينشره على `https://USERNAME.github.io/REPO/`.

هذه النسخة (`npm run build:static`) تشغّل النظام كله داخل المتصفح، فالبيانات تُحفظ في المتصفح فقط ولا تُشارك بين الأجهزة.
حسابات التجربة معروفة للجميع (`admin@demo.local` / `demo-admin` و`cashier@demo.local` / `demo-cashier`)، لذلك **لا تُدخل بيانات حقيقية فيها**.
للاستخدام الفعلي استخدم النسخة ذات الخادم وقاعدة البيانات (قسم النشر أعلاه).

### Pre-launch checklist
1. `cd server && npm install && npm test`, and `cd web && npm install && npm run build` must both pass.
2. Log in, create an income and an expense, submit, approve with a second user, and confirm the dashboard numbers.
3. Schedule PostgreSQL backups (`pg_dump`) and test a restore. This is financial data.
4. Have an Egyptian accountant review the chart of accounts and posting rules (see below).
5. Change the seeded admin password policy/owner email; do not reuse `.env.example` values.

## Requirements
Node 20+, PostgreSQL 14+.

## Setup
```bash
# 1. Database
createdb geography_accounting

# 2. Backend
cd server
cp .env.example .env          # edit DATABASE_URL, SESSION_SECRET (>=32 chars), ADMIN_EMAIL, ADMIN_PASSWORD (>=12 chars)
npm install
npm run migrate
npm run seed                  # default chart of accounts + first Super Admin. No demo transactions.
npm test                      # money / journal / permission unit tests
npm run dev                   # API on :4000

# 3. Frontend (second terminal)
cd web
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :4000)
```

## Accounting rules in Phase 1
- Amounts are integer piastres (BigInt) in the server and `BIGINT` in PostgreSQL; the browser only formats strings.
- Every posted entry balances (checked in code and by a database trigger). Posted entries cannot be edited or deleted; corrections are reversal entries.
- Income/expense transactions are cash-settled: approval posts Dr cash/bank, Cr revenue (income) or Dr expense, Cr cash/bank (expense).
  Receivables, payables and commission recognition arrive in Phase 2. **The default chart of accounts and these rules must be reviewed by a qualified Egyptian accountant.**
- Creator cannot approve their own transaction (enforced in the API and by a database CHECK). Approval limits per user are supported.
- No tax rates are hardcoded; company legal name, tax and commercial registration numbers are blank until you enter them.

## Brand
`web/public/logo.jpg` is the original file, shown unmodified. Palette measured from it: orange `#F8A018`, taupe `#706050`, blue `#447894` (`web/src/styles/tokens.css`).
The supplied logo is a JPG on a white background; a transparent PNG/SVG would look better on the dark sidebar.

## Known limitations / not yet built
- Phase 1 gaps: manual journal entry screens, reversal endpoint and UI, trial balance and ledger reports, user management screen, CSV export, file attachments, bank accounts management UI, dashboard charts.
- Phase 2–4 entirely: projects/developers, deals and commissions, AR/AP, invoices and PDFs, financial statements, bank reconciliation, imports, backups guide, security review.
- No integration tests against a real database yet.
