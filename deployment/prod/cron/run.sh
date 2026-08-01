#!/bin/sh
# Call one /api/cron/* endpoint on the app container. Invoked by busybox crond.
#
# Talks to `web:3000` over the compose network, NOT the public domain: no TLS
# handshake, no round trip through Caddy, and the job keeps running even while
# DNS is mid-cutover. authorizeCron() accepts the shared secret regardless of
# origin, so this is the same code path an external scheduler would hit.
set -eu
job="$1"

if [ -z "${CRON_SECRET:-}" ]; then
  echo "[cron] $job SKIPPED: CRON_SECRET is empty" >&2
  exit 1
fi

# busybox wget: -q quiet, -O- to stdout, -T timeout. A non-2xx status exits
# non-zero, which crond logs (-l 8) and Docker ships to CloudWatch.
if out=$(wget -q -O- -T 300 --header="x-cron-secret: ${CRON_SECRET}" \
  "http://web:3000/api/cron/${job}" 2>&1); then
  echo "[cron] $job ok ${out}"
else
  echo "[cron] $job FAILED ${out}" >&2
  exit 1
fi
