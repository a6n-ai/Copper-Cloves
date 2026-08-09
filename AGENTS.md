## Learned User Preferences

- Frequently requests to start, stop, or restart the dev server and to push changes — execute directly when asked.
- When pushing: commit uncommitted project code first, then push to `origin/main`.
- Before commit/push when asked: summarize what will be committed; user may want to approve first.
- Never commit dummy/demo finance seed data; keep real financial records untouched.
- Never commit or push S3 seed/migration ops (`scripts/migrate-images-*.ts`, `scripts/test-s3.ts`) — local-only; do not upload or register prod image data via git.
- Do not commit unless explicitly asked: `.idea/`, `.vscode/`, `public/uploads/`, `.cursor/`, `.agents/`, `.claude/`, `.llm/`, `.softgen/`, `.superpowers/`, `skills-lock.json`, one-off `scripts/` backfills/inspects, or other local tooling/credential files.
- When Docker is down, use `npm run dev:next` (not `npm run dev`); dev server runs on port 3000 or 3001.
- Use Razorpay MCP for Razorpay integration patterns when relevant.

## Learned Workspace Facts

- Next.js app for The Studio by Copper + Cloves (member portal, admin, instructor, partner).
- `npm run dev`: Docker Postgres + Next; `npm run dev:next`: Next only — use when Docker is off; `npm run dev:fresh` deletes `.next` then runs `dev:next`.
- Local Postgres via Docker: host `127.0.0.1`, port **5433** (`STUDIO_DATABASE_URL` in `.env.local`).
- Production: **EC2 + Docker Compose** (`deployment/prod/`), ap-south-1, Caddy as sole ingress, pgbouncer in front of RDS, `cc-cron` for the `/api/cron/*` schedule. Runbook: `deployment/prod/RUNBOOK.md`. Amplify was deleted in Aug 2026 — there is no hosting console.
- Prod env vars live in SSM under `/copper-cloves/prod`; `deploy.sh` renders them to `.env.production`. There is no hosting console to edit.
- Canonical origin is **www** (`https://www.thestudiobycopperandcloves.in`); apex 301s to it. `NEXTAUTH_URL` must match the canonical host exactly or every session breaks on the CSRF/origin check.
- Default branch `main`; GitHub remote `ranga768/Copper-Cloves`.
- Prisma uses `db push` / `npm run ci:db-push` (run by the `migrate` service against RDS directly, bypassing the pooler), not checked-in migration SQL; client in `src/generated/prisma/`.
- Prod env minimum: `STUDIO_DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, Razorpay keys + `RAZORPAY_WEBHOOK_SECRET`, `CRON_SECRET`.
- Razorpay webhook endpoint: `/api/razorpay/webhook`; amounts stored in paise.
- Production RDS: `copper-cloves` Postgres in ap-south-1.
- Local repo context docs in `.llm/` (gitignored, not on remote) — `/llm` slash command lists topics.
- `.gitignore` excludes agent/IDE folders and one-off script patterns; `.llm/`, `public/uploads/`, and guest backfill scripts were untracked from `main`.
