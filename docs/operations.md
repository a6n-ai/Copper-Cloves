# Operations

## Deployment

Production runs on a single EC2 host with Docker Compose (`deployment/prod/docker-compose.yml`):

| Service | Role |
|---|---|
| Caddy | TLS ingress |
| `web` | Next.js standalone server |
| pgbouncer | Connection pooling to RDS |
| `cc-cron` | busybox crond calling `/api/cron/*` |

Postgres is AWS RDS (private, `ap-south-1`).

**Pipeline:** `.github/workflows/deploy-prod.yml` runs on push to `main`. It lints, builds the `web` and `tools` images from `deployment/Dockerfile` tagged with the commit SHA, then SSHes to the box and runs `deploy.sh`. The deploy runs `prisma db push` (plus raw SQL triggers) before starting the new app. Changes only to `*.md`, `docs/**` or `.llm/**` skip the deploy.

**Rollback:** `IMAGE_TAG=<old-sha> ./deploy.sh` on the box.

**Secrets:** stored in SSM under `/copper-cloves/prod/*`. `deploy.sh` writes them into `.env.production`, which both `web` and `cron` read.

Box-level steps: [`deployment/prod/RUNBOOK.md`](../deployment/prod/RUNBOOK.md).

## Scheduled jobs

Crontab: `deployment/prod/cron/crontabs/root` (UTC). Each job is an idempotent HTTP endpoint guarded by `x-cron-secret`, and writes a `cron_runs` row.

| Endpoint | Cadence | Does |
|---|---|---|
| `/api/cron/class-emails` | 5 min | Member reminders ~1h before class, instructor rosters ~6h before |
| `/api/cron/reconcile-no-shows` | 15 min | Marks past-due bookings `no_show`; advances class statuses |
| `/api/cron/lifecycle-bookings` | 15 min | Recovery email + seat release for unpaid holds |
| `/api/cron/reconcile-razorpay` | hourly | Fulfils paid-but-stuck orders |
| `/api/cron/partner-webhooks` | 1 min | Delivers partner webhook outbox with retries |
| `/api/cron/resume-passes` | daily 01:20 | Ends finished pass pauses |
| `/api/cron/expire-passes` | daily 01:25 | Deactivates expired passes |

Run one by hand:

```bash
curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/class-emails
```

An admin session also authorises, so the admin cron-health panel can trigger jobs.

**Adding a job:** handler in `src/pages/api/cron/` using `authorizeCron()` and logging a `CronRun`, add a crontab line, redeploy.

**Gotchas:**
- busybox crond ignores crontab files it does not own. The container copies the crontab to root-owned `/etc/crontabs` at start.
- Run crond with `-d 5`, never `-l` (the image has no syslogd, so logs vanish).
- Restart only cron with `docker compose up -d --no-deps cron`.

**Health check:** `select job, max(started_at) from cron_runs group by job;`

## Database access

Prod RDS is not publicly reachable. Either tunnel:

```bash
ssh -L 5432:<rds-endpoint>:5432 ec2-user@<box-ip>
```

or run on the box:

```bash
docker compose run --rm --entrypoint sh migrate -c 'npx tsx scripts/<name>.ts'
```

The Prisma CLI gets `sslmode=require` added automatically for managed hosts (`prisma.config.ts`).

## Logs

- `docker compose logs -f web` / `cron`
- CloudWatch log group `/copper-cloves/prod`

## Known issues

Tracked in [`.llm/known-issues.md`](../.llm/known-issues.md). Highlights:

- Seat capacity check is read-then-insert, so two simultaneous bookings can both take the last seat.
- Admin pass config + payment recording is two API calls, not one transaction.
- `UserStats` and `UserStreak` both track streaks and can diverge.
- `tsconfig` is `strict: false`; run `tsc` after refactors.
