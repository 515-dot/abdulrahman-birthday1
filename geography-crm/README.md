# Geography Real Estate — CRM

Internal CRM for Geography Real Estate: sales, marketing, HR and creative workspaces with
server-enforced role-based access. Arabic (RTL) by default.

> **Status: unverified source code.** It has not been installed, built or run. See `STATUS.md`
> for what exists and what does not. Do not deploy to production until the checks below pass.

## Requirements
Node 22+, PostgreSQL 15+.

## Setup
```bash
npm install
cp .env.example .env        # set DATABASE_URL, SESSION_SECRET (openssl rand -base64 48)
npx prisma migrate dev --name init
npm test                    # permission-engine tests
npm run db:seed             # departments, roles, permissions, pipeline stages (no fake people)
INITIAL_ADMIN_EMAIL=you@company.com INITIAL_ADMIN_PASSWORD='choose-a-strong-one' npm run setup:admin
npm run dev
```
Sign in at `/admin/login`; the Super Admin must change the password at first login.
Employees sign in at `/login` with accounts the Super Admin creates under `/admin/users`.
The setup script refuses to run if a Super Admin already exists. There is no backdoor account.

## Security model (as designed — verify before relying on it)
- Argon2id password hashes; credentials stored in their own table.
- Sessions are DB rows; suspending an account revokes them and is effective on the next request.
- Every API route and page checks permissions on the server (`requireUser` / `requirePage`).
- Lead access is enforced in database queries (`leadScopeWhere`), not in the UI.
- Mutating routes require same-origin requests; cookies are HttpOnly + SameSite=Lax.
- Salary, commission and budget data are separate permissions; accesses are audit-logged.
- Audit events strip any field that looks like a secret.

## Deployment
1. Provision managed PostgreSQL with TLS; set `DATABASE_URL`.
2. Set `SESSION_SECRET` and other secrets via your platform's secret store, never in git.
3. `npm run build && npm run db:deploy && npm start` behind HTTPS (cookies are `secure` in production).
4. Replace the in-memory rate limiter (`src/lib/rate-limit.ts`) with Redis if running more than one instance.
5. Run `npm run setup:admin` once, then remove `INITIAL_ADMIN_*` from the environment.

## Backup and recovery
- Daily: `pg_dump --format=custom "$DATABASE_URL" > geography_$(date +%F).dump`; encrypt and store off-site; keep 30 days.
- Enable point-in-time recovery (WAL archiving) on the managed database if available.
- Restore: `pg_restore --clean --if-exists --dbname "$DATABASE_URL" geography_YYYY-MM-DD.dump`.
- Test a restore into a scratch database at least monthly. Back up uploaded files separately once file storage is added.

## Integrations
WhatsApp, email, calendars, ad platforms and cloud storage are **not implemented**. AI is limited to
one feature (lead follow-up drafts) and stays disabled until `AI_PROVIDER`, `AI_API_KEY` and `AI_MODEL` are set.
