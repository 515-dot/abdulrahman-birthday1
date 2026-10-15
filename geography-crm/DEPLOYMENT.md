# Deployment guide (Vercel + managed PostgreSQL)

## Why the site showed "404 — File not found"
That exact message is GitHub Pages. GitHub Pages serves static files only. This CRM is a
server-rendered Next.js app (sessions, API routes, Prisma, PostgreSQL), so there is no
`index.html` to serve and every URL returns 404. The fix is to host the app on a Node-capable
platform. GitHub stays as the source repository only.

> Status: the code changes below were made but **not built or run** in the authoring sandbox
> (npm registry and PostgreSQL were unavailable). Run the checks in step 4 before going live.

## 1. Stop using GitHub Pages
Repository → Settings → Pages → set Source to "None" / unpublish. Delete any `gh-pages` branch
and any workflow that publishes to Pages. Keep the repository itself.

## 2. Repository layout
`package.json`, `next.config.mjs` and `src/` must be at the repository root. If you uploaded the zip
so everything sits inside a subfolder, either move the contents up or set Vercel's
"Root Directory" to that subfolder.
**Never commit `.env`.** It is in `.gitignore`; only `.env.example` belongs in Git.

## 3. Database
1. Create a managed PostgreSQL database (Neon, Supabase, Railway, Vercel Postgres, etc.) with TLS.
2. Copy its connection string (`postgresql://…?sslmode=require`). On serverless, use the provider's
   pooled connection string for the app.
3. **Create the migration once, on your machine, against a development database:**
   `npx prisma migrate dev --name init` — then commit the generated `prisma/migrations/` folder.
   (The repository currently has no migrations, so `migrate deploy` would create nothing.)
4. Apply to production without resetting anything: set `DATABASE_URL` to the **direct** (non-pooled)
   production URL in your local `.env`, run `npx prisma migrate deploy`. Never run `migrate reset`
   or `db push --force-reset` against production.

## 4. Verify locally first
```
npm ci            # or npm install (generates package-lock.json: commit it)
npx prisma validate
npm run typecheck
npm test
npm run build
npm start         # then open http://localhost:3000 → should redirect to /admin/login
```
Fix any real errors. Do not suppress them.

## 5. Environment variables (Vercel → Project → Settings → Environment Variables)
| Name | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | production PostgreSQL (pooled for serverless) |
| `SESSION_SECRET` | yes | new value: `openssl rand -base64 48` |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` | no | AI stays disabled ("not configured") when empty |
| `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` | only for setup | used by the one-time script below; do not store in Vercel |
`WHATSAPP_*` and `SMTP_URL` appear in `.env.example` but no code uses them yet.

## 6. Deploy
Vercel → Add New Project → import the GitHub repository → Framework Preset "Next.js" → add the
variables → Deploy. (`postinstall` runs `prisma generate`.) Add your custom domain afterwards.
Check Vercel's plan terms: the free Hobby plan is for personal, non-commercial use. For company use
choose a paid plan or another Node host (Railway, Render, a VPS running `npm start` behind HTTPS).

## 7. Create reference data and the Super Admin (once, from your machine)
With a local, uncommitted `.env` containing the production `DATABASE_URL` and your chosen admin values:
```
npm run db:seed          # departments, roles, permissions, pipeline stages (idempotent)
npm run setup:admin      # refuses to run if a Super Admin already exists
```
Choose your own strong password. Then delete `INITIAL_ADMIN_PASSWORD` from the file. At first login
the admin must change the password. Create employees at `/admin/users` and assign roles there.

## 8. Post-deploy checks
- `/` redirects to `/admin/login`; `/login` loads; the logo loads; an unknown URL shows the Arabic 404.
- While signed out, `/admin`, `/sales`, `/hr`, `/marketing`, `/creative` redirect to login and
  `GET /api/leads` returns 401.
- Sign in as a sales user: `/hr` and `/admin` must send you to `/forbidden`.
- Suspend a user: their next request must fail.

## 9. Secrets that must be rotated
An earlier delivery of this project included a `.env` with a generated `SESSION_SECRET` and an admin
password that was also shown in chat. Treat both as compromised: generate a new `SESSION_SECRET`, and
never use that admin password. If any `.env` or that zip was ever committed to GitHub, remove it from
history (or recreate the repository) and rotate every credential it contained, including `DATABASE_URL`.

## 10. Known limits on serverless hosting
- The in-memory rate limiter does not share state across instances. Per-account lockout (stored in the
  database) still works; add Redis (e.g. Upstash) for IP-level limiting.
- No file storage, SMTP, MFA or external integrations are implemented yet.
- No Content-Security-Policy header is set yet (other security headers are in `next.config.mjs`).
