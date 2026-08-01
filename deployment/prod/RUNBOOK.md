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

## Cutover from Amplify

1. Bring the box up and verify on a staging hostname first
   (`new.thestudiobycopperandcloves.in` → EIP; set `APP_DOMAIN` to it).
   Razorpay webhooks are registered against the apex, so on the staging host
   payment fulfillment only heals via the `reconcile-razorpay` cron — do not
   read that as a broken checkout.
2. Set `APP_DOMAIN` and `NEXTAUTH_URL` in SSM to the apex, redeploy.
3. Flip DNS by redeploying the stack with `ManageApexDns=true`. Records are
   created at TTL 60 so a rollback to Amplify propagates in a minute.

   **Delete the existing `www` CNAME by hand first.** Route53 will not UPSERT a
   record across a type change (`CNAME` → `A`), so the stack update fails with
   `RRSet of type A with DNS name www... already exists` unless the old record is
   gone. The apex is already an `A` (alias) record, so that one upserts cleanly.
4. Leave the Amplify app in place for a few days as rollback, then delete it,
   along with `amplify.yml` and `.github/workflows/cron.yml` (the in-box cron
   container replaces it — running both would double every tick, which is
   harmless but noisy).
5. Lock down the database: set the RDS to `PubliclyAccessible=false` and drop any
   public 5432 rules from `sg-0de569aec9a0fa534`. The box reaches it via the
   security-group rule this stack created.

## Gotchas

- **`docker compose up -d` will not pick up a Caddyfile edit.** Nothing about the
  container changed, so compose leaves it alone. Run
  `docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile`
  (the deploy workflow already does).
- **`.env.production` is generated, never edited by hand.** The next deploy
  overwrites it. Change the SSM parameter instead.
- **`www` and any other hostname must stay redirects.** `NEXTAUTH_URL` pins one
  canonical origin; a second live origin breaks sign-in with a CSRF/origin
  mismatch rather than an obvious error.
- **Migrations bypass pgbouncer deliberately** (`DIRECT_DATABASE_URL`). Pointing
  `db push` at the pooler would drop its session-level advisory lock at the first
  transaction boundary.
