# Geography Real Estate — Accounting System (Phase 1)

> **Status: Phase 1 is NOT verified end-to-end.** Only the pure accounting logic (`server/src/lib`) has automated tests (11 passing).
> The SQL migrations, API routes and React UI were written without being able to install packages or run PostgreSQL,
> so they have only been syntax-checked. Run the steps below and the tests before trusting any number.

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
