# Geography CRM — Build Status

**Nothing in this repository has been installed, built, type-checked, or run.**
The build sandbox blocked the npm registry (HTTP 403 from the egress policy) and
has no PostgreSQL server. Everything below is unverified source. Not production-ready.

## Written (unverified)
- Brand palette sampled from the logo → `src/app/globals.css`; logo in `public/logo.jpg`
- Prisma schema for the full entity list → `prisma/schema.prisma` (credentials and salary in separate tables)
- Permission engine (RBAC, per-user grants/revokes, record-level lead scope, escalation guard)
  → `src/lib/permissions.ts` + tests `permissions.test.ts`
- Argon2id hashing, hashed reset tokens, rate limiter + lockout → `src/lib/password.ts`, `rate-limit.ts`
- DB-backed sessions (suspend/revoke takes effect on the next request) → `src/lib/session.ts`
- Guards: `requireUser({permission})`, same-origin CSRF check → `src/lib/auth.ts`
- Audit logging with secret scrubbing → `src/lib/audit.ts`
- API: login (separate admin/employee portals, generic errors, rate limit, lockout),
  logout, change-password (forced at first login), create user, suspend/activate user
- Pages: `/admin/login`, `/login` (Arabic RTL, logo, show/hide password, remember me)
- Role → workspace redirect from the DB role, never from the form → `src/lib/workspace.ts`
- One-time Super Admin bootstrap from env vars → `scripts/setup-admin.ts`
- Reference seed (departments, roles, permissions, pipeline stages; no fake people or metrics) → `prisma/seed.ts`

## Sales + admin API (written, unverified)
- `GET/POST /api/leads` — list is filtered in the DB by `leadScopeWhere`; owner is the creator, never from the body
- `GET/PATCH /api/leads/[id]` — record-level check, 404 for hidden records, strict field allow-list
- `POST /api/leads/[id]/assign` — handoff limited to active sales staff in the actor's team (unless view_all)
- `POST /api/leads/[id]/activities` — calls, meetings, WhatsApp, email, notes, follow-ups
- `GET /api/leads/export` — CSV limited to the user's visible leads, formula-injection safe, audited
- `GET /api/admin/stats` — dashboard figures from real queries (zeros when empty)
- `GET /api/admin/audit` — audit log viewer, requires `audit_logs.view`

## Department + AI API (written, unverified)
- Deals: `GET/POST /api/deals`; commission amounts only returned with `sales.view_commissions`;
  `PUT /api/deals/[id]/commission` (won deals only, audited with before/after rate)
- HR: `GET /api/hr/employees` (directory; salary only via `?salary=1` with `hr.view_salary_records`, audited);
  `/api/hr/leave` (own requests for everyone, all for `hr.manage_attendance`; no self-approval; generic notifications)
- Marketing: `/api/marketing/campaigns` (budget/spend hidden and ignored without `marketing.manage_budgets`)
- Creative: `/api/creative/projects` (designers see only assigned projects; marketing can send a brief
  to a creative-team assignee without gaining studio access)
- AI: `src/lib/ai.ts` server-side provider call (503 "not configured" state, never simulated);
  `/api/ai/lead-followup` uses the same lead visibility policy, sends only first name, stage, budget
  and recent notes, rate-limited, logs usage and returns the data it was based on

## UI pages (written, unverified; Arabic RTL, server-guarded)
`/admin` dashboard (real queries, empty states), `/admin/users` (create account with one-time temporary
password, suspend/activate), `/admin/audit`, `/change-password`, `/sales`, `/marketing`, `/hr`,
`/creative` (status columns), `/forbidden`, `/no-workspace`. Shared shell with permission-filtered nav.
`README.md` covers setup, deployment and backup/restore.

## Added in round 2 (written, unverified)
- Permission management: `/admin/roles` editor + `PUT /api/roles/[id]/permissions`, `PUT /api/users/[id]/permissions`
  (per-user grants/revokes), both with the escalation guard and audit events
- Admin password reset: `POST /api/users/[id]/reset-password` (one-time temporary password, sessions revoked)
- Clients (`/api/clients`, owner-scoped), properties + project/developer/location/type (`/api/properties`),
  reservations with atomic double-booking protection (`/api/reservations`)
- HR attendance (`/api/hr/attendance`, self-service check-in/out) and payroll (`/api/hr/payroll`, separate
  `hr.manage_payroll` / `hr.view_salary_records` permissions, audited without amounts)
- Creative workflow transitions + approval records (`PATCH /api/creative/projects/[id]/status`)
- Marketing content calendar API (`/api/marketing/content`)
- Sales UI: add-lead form, lead detail page with stage change and activity timeline
- New permissions: `properties.manage`, `hr.manage_payroll`

## Round 3: 404 / deployment fix (written, unverified)
- Root cause: GitHub Pages cannot serve a Next.js server app (see `DEPLOYMENT.md`).
- `/` now redirects: signed-in → own workspace, signed-out → `/admin/login` (no content rendered).
- Arabic `not-found.tsx` and `error.tsx`; `next.config.mjs` (argon2 externalized, security headers);
  `postinstall: prisma generate`, `typecheck` script, `engines`.
- `.env` removed from the project archive; `DEPLOYMENT.md` added.
- **Blocker: no `prisma/migrations` folder yet.** Generate with `prisma migrate dev --name init` and commit it.
- Not verified: install, prisma validate, typecheck, tests, build, runtime, any deployed URL.

## Still missing
Recruitment/candidates API, training and performance records, asset upload with version history
(needs file storage), comments on creative projects, sales targets, notification centre UI, dashboard
filters, English/LTR switcher, self-service email password reset (needs SMTP), MFA, integrations,
other AI assistants, and API-level authorization tests against a real database.

## Known gaps / decisions to review
- Manager roles share the same pages as their teams; differences come from permissions, not separate routes.
- No language switcher yet (Arabic only); components use logical CSS properties so LTR can be added.
- Charts are simple CSS bars, not a charting library; no date/department filters on the dashboard.
- Deals list: managers see own deals or all deals (view_all); there is no team-level deal scope yet.
- AI is implemented for one feature (lead follow-up drafts) and one provider adapter only.
- `POST /api/users` requires both `users.create` and `roles.manage` in practice
  (role assignment is escalation-checked). Decide if HR admins need a narrower path.
- Rate limiter is in-memory (single instance only).
- No migrations generated yet (`prisma migrate dev` needs a live database).
- Tests written but never executed. Auth/API tests against a database do not exist yet.

## Not started
Password reset flow, MFA, user-management UI, permission-management UI, workspace
pages (`/admin`, `/sales`, `/marketing`, `/hr`, `/creative`), sales CRM, marketing,
HR, Creative Studio, AI services, dashboards, audit-log UI, integrations,
deployment and backup docs.

## Run order once packages and Postgres are available
```
npm install
cp .env.example .env   # DATABASE_URL, SESSION_SECRET, INITIAL_ADMIN_*
npx prisma migrate dev --name init
npm test
npm run db:seed
npm run setup:admin
npm run dev            # then open /admin/login
```
