#!/usr/bin/env bash
# Copper & Cloves prod deploy. Images are built + pushed to GHCR by CI; this
# regenerates .env.production from SSM, syncs the schema, then restarts.
#
# Requires on the box: docker, awscli, jq, and the instance role granting
# ssm:GetParametersByPath on /copper-cloves/prod (+ kms:Decrypt, logs:*).
# Run on the box directly, or via .github/workflows/deploy-prod.yml.
set -euo pipefail
cd "$(dirname "$0")" # deployment/prod — compose + .env.production live here

SSM_PATH="${SSM_PATH:-/copper-cloves/prod}"
SSM_REGION="${SSM_REGION:-ap-south-1}"
umask 077 # .env.production holds every secret; never world-readable

# Values are single-quoted because that is the ONLY quoting both the shell `.`
# below and compose's env_file: treat as fully literal — unquoted or
# double-quoted values get $-interpolated, which would mangle any secret
# containing a `$`. A value containing a single quote cannot be represented, so
# fail loudly rather than write a file that silently mis-parses.
aws ssm get-parameters-by-path --region "$SSM_REGION" --path "$SSM_PATH" \
	--recursive --with-decryption --query 'Parameters[].[Name,Value]' --output json |
	jq -r '.[]
      | (.[0] | split("/") | last) as $k
      | .[1] as $v
      | ([39] | implode) as $q
      | if ($v | explode | index(39))
        then error("\($k): value contains a single quote, which .env.production cannot represent - change the parameter value")
        else "\($k)=\($q)\($v)\($q)"
        end' >.env.production.tmp
test -s .env.production.tmp || {
	echo "no parameters under $SSM_PATH in $SSM_REGION"
	exit 1
}
mv .env.production.tmp .env.production
# Caddy reads ACME_EMAIL + APP_DOMAIN from the same generated file.
cp .env.production proxy/.env.production

# Source it so compose can interpolate ${DIRECT_DATABASE_URL}, ${AWS_REGION},
# ${PGBOUNCER_*} in the compose files themselves (env_file only reaches
# containers, not compose's own variable substitution).
set -a
. ./.env.production
set +a

export IMAGE_TAG="${IMAGE_TAG:-latest}"

docker compose pull # web + tools at IMAGE_TAG

# Schema sync BEFORE the new code starts, against RDS directly (not the pooler).
docker compose --profile tools run --rm migrate

docker compose up -d

# The cron service pins an unchanging image, so plain `up -d` leaves it running
# and busybox crond keeps serving the crontab it copied to /etc/crontabs at its
# last start — a schedule change in git would silently never take effect.
# --no-deps so this doesn't drag cc-web through a second recreate.
docker compose up -d --no-deps --force-recreate cron

docker image prune -af
