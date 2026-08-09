# Copper & Cloves — production runbook

Single EC2 box in ap-south-1 running four containers behind Caddy, talking to the
**existing** `copper-cloves` RDS through pgbouncer.

```
internet ──443──▶ cc-caddy ──edge net──▶ cc-web (Next standalone, :3000)
                                            │  default net
                                            ▼
                                        cc-pgbouncer (:6432, transaction pool)
                                            │  TLS
                                            ▼
                       copper-cloves.<...>.ap-south-1.rds.amazonaws.com:5432

cc-cron ──http──▶ cc-web /api/cron/*        (busybox crond, x-cron-secret)
migrate ──TLS──▶ RDS directly               (one-shot, bypasses the pooler)
```

Two compose projects on the box, joined by the external `edge` network:

| Path | Project |
|---|---|
| `deployment/prod/` | `web`, `cron`, `pgbouncer`, `migrate` (tools profile) |
| `deployment/prod/proxy/` | `caddy` — the only thing binding :80/:443 |

## First-time setup

1. **Push secrets to SSM** (`/copper-cloves/prod`, ap-south-1). Every var in
   `.env.production.example` becomes one parameter; the last path segment is the
   env var name.

   ```bash
   aws ssm put-parameter --region ap-south-1 --type SecureString --overwrite \
     --name /copper-cloves/prod/NEXTAUTH_SECRET --value '...'
   ```

   Values must not contain a single quote — `deploy.sh` fails loudly rather than
   write a file that mis-parses.

2. **Create the stack.**

   ```bash
   aws cloudformation deploy --region ap-south-1 \
     --template-file infra/copper-cloves-prod.yaml \
     --stack-name copper-cloves-prod \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides SubnetId=subnet-xxxx KeyName=your-key
   ```

   Outputs give the Elastic IP and instance id. User-data installs docker +
   compose, creates the `edge` network, and clones the repo to
   `~ec2-user/Copper-Cloves`.

3. **Set the repo secrets/variables** used by `.github/workflows/deploy-prod.yml`:
   `EC2_HOST` (the EIP), `EC2_USER` (`ec2-user`), `EC2_SSH_KEY` (private key),
   and variable `ENABLE_SSH_DEPLOY=true`.

4. **First deploy** — push to `main`, or on the box:

   ```bash
   cd ~/Copper-Cloves/deployment/prod && IMAGE_TAG=latest ./deploy.sh
   (cd proxy && docker compose up -d)
   ```

   Caddy will fail to issue a certificate until DNS points at the box; that is
   expected before cutover and it retries on its own.

## Deploying

Push to `main`. CI builds both images tagged with the commit SHA, then SSHes in
and runs `deploy.sh`, which regenerates `.env.production` from SSM, runs
`prisma db push` against RDS directly, and restarts the stack.

## Rollback

Images are immutable per commit, so roll back by pinning the old tag:

```bash
cd ~/Copper-Cloves/deployment/prod
IMAGE_TAG=<previous-sha> ./deploy.sh
```

Note this does **not** revert the schema — `db push` is forward-only. A rollback
across a destructive schema change needs a restore from the RDS snapshot.

## Everyday operations

```bash
cd ~/Copper-Cloves/deployment/prod

docker compose ps                      # what is running
docker compose logs -f web             # app logs (also in CloudWatch /copper-cloves/prod)
docker compose logs -f cron            # every cron tick, with the endpoint's JSON reply
docker compose restart web

# Run any repo script against prod (seeds, backfills) using the tools image:
docker compose run --rm --entrypoint sh migrate -c 'npx tsx scripts/backfill-completed-schedules.ts'

# Check the pool from inside the network:
docker compose exec pgbouncer psql -h 127.0.0.1 -p 6432 -U "$PGBOUNCER_DB_USER" pgbouncer -c 'SHOW POOLS;'
```

## DNS

The box is the only origin. Route53 zone `Z042772335FKJXJEWCHU9` holds three plain
A records at the EIP, TTL 60 — apex, `www`, and `new` (the staging hostname, still
pointed at the same box). `www` is canonical; the apex 301s to it via Caddy.

Records are managed by the CloudFormation stack (`ManageApexDns=true`). If any go
missing, re-run the stack to restore them. TTL stays at 60 so a correction
propagates in a minute.

**Verifying DNS from a hijacked network.** Plaintext DNS is rewritten on some ISPs
here — even a query aimed straight at the authoritative nameserver comes back wrong,
because port 53 itself is intercepted. The tell is the TTL: the zone serves 60, the
interceptor stamps its own (10 observed). Use DNS-over-HTTPS to get the truth:

```bash
curl -s -H 'accept: application/dns-json' \
  'https://cloudflare-dns.com/dns-query?name=www.thestudiobycopperandcloves.in&type=A'
```

The same networks also blackhole TLS to the box: TCP connects, the handshake never
completes, and the site looks dead from your laptop while it serves everyone else.
To check the origin itself rather than the path to it, look at whether `cron_runs`
is still advancing — those rows are written by requests arriving over the public
HTTPS URL, so a fresh timestamp proves the site is reachable from the internet.

## Post-cutover checklist

1. **Confirm `cc-cron` is actually ticking** before relying on it for reminders,
   no-show reconciliation or the Razorpay backstop:
   `docker compose logs --tail=30 cron`, then check the spacing in
   `select job, max(started_at), count(*) from cron_runs group by job`.
   Even 5/15-minute gaps = in-box crond doing its job. Ragged 45–100 minute gaps
   mean something external is driving them instead.
2. ~~Lock down the database.~~ **DONE Aug 9 2026.** `copper-cloves` RDS is
   `PubliclyAccessible=false`; the `0.0.0.0/0` rules on `sg-0de569aec9a0fa534`
   (an all-protocols rule, plus a 3306 leftover from the retired `thestudio`
   MySQL DB) are revoked. Inbound is now only `5432` from the box SG
   `sg-08892c06fbc00f9c9`, plus the group's self-reference. Backup retention
   raised 1 → 7 days at the same time.

   **Consequence: the DB is no longer reachable from a laptop.** `db:push`,
   `db:studio` and any `tsx` script pointed at prod need a tunnel first:

   ```bash
   ssh -L 5432:copper-cloves.c52g80yysrkp.ap-south-1.rds.amazonaws.com:5432 ec2-user@13.235.22.94
   ```

   Or run it on the box instead, which needs no tunnel:
   `docker compose run --rm --entrypoint sh migrate -c 'npx tsx scripts/<name>.ts'`

## Gotchas

- **Changing a domain requires `--force-recreate` on the proxy.** Caddy reads
  `APP_DOMAIN`, `REDIRECT_DOMAIN` and `ACME_EMAIL` from the environment at
  container startup. `deploy.sh` rewrites `proxy/.env.production` from SSM, but
  compose does not treat an env_file content change as a reason to recreate the
  container — so Caddy keeps serving the OLD vhost and HTTPS on the new name
  fails with a TLS alert rather than any useful error. This caused a ~2 minute
  outage during the cutover to this stack. The deploy workflow now passes
  `--force-recreate`; if you run the proxy by hand, do the same.
- **`docker compose up -d` will not pick up a Caddyfile edit.** Nothing about the
  container changed, so compose leaves it alone. Run
  `docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile`
  (the deploy workflow already does).
- **`.env.production` is generated, never edited by hand.** The next deploy
  overwrites it. Change the SSM parameter instead.
- **busybox crond silently ignores a crontab it does not own.** A crontab file
  whose owner is not the user the jobs run as is skipped with no error, at any
  log level — `docker ps` shows the container healthy, `crond` wakes every
  minute, and nothing ever executes. The bind mount carries the host checkout's
  ownership (`ec2-user`, uid 1000), so the `cron` service copies the file to
  root-owned `/etc/crontabs` at startup rather than pointing `-c` at the mount.
  This cost 6 days of silently dead crons in Aug 2026. Do not "simplify" it back
  to `-c /cron/crontabs`.
- **Use `-d N` for crond, never `-l N`.** `-l` only sets a level and leaves
  busybox logging to syslog; this image has no syslogd, so every tick and job
  result is discarded and `docker logs cc-cron` stays empty even when jobs run.
- **`docker compose up -d cron` restarts `cc-web` too.** `cron` declares
  `depends_on: web`, so compose pulls and recreates the dependency. Use
  `docker compose up -d --no-deps cron` to touch the cron container alone.
- **`www` and any other hostname must stay redirects.** `NEXTAUTH_URL` pins one
  canonical origin; a second live origin breaks sign-in with a CSRF/origin
  mismatch rather than an obvious error.
- **Migrations bypass pgbouncer deliberately** (`DIRECT_DATABASE_URL`). Pointing
  `db push` at the pooler would drop its session-level advisory lock at the first
  transaction boundary.
