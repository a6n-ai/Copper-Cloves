# syntax=docker/dockerfile:1
# Copper & Cloves production image. Build context is the repo root.
#
# Two targets, both pushed to GHCR by .github/workflows/deploy-prod.yml:
#   runner  -> copper-cloves-web    Next.js standalone server (the app)
#   build   -> copper-cloves-tools  full node_modules + prisma CLI + tsx
#                                   (used by the one-shot `migrate` service and
#                                   for running seed/backfill scripts on the box)

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
# node:22-alpine bundles npm 10, which resolves this tree differently from the
# npm 11 that wrote package-lock.json — `npm ci` then aborts with
# "lock file's picomatch@2.3.2 does not satisfy picomatch@4.0.5". Pin the major
# so the lockfile is interpreted by the version that produced it.
RUN npm install -g npm@11
WORKDIR /app

# --- build: deps (cached on the lockfile) -> prisma generate -> next build ---
FROM base AS build
COPY package.json package-lock.json ./
# This layer is invalidated only when the lockfile changes, so source edits do
# not re-download dependencies.
RUN npm ci --no-audit --no-fund
COPY . .
# Build identifier: next.config.mjs uses it for generateBuildId AND exposes it as
# NEXT_PUBLIC_BUILD_ID, which BuildVersionWatcher polls to soft-reload stale tabs.
# CI passes the commit SHA.
ARG BUILD_ID=dev
ENV NEXT_PUBLIC_BUILD_ID=${BUILD_ID}
# NEXT_PUBLIC_* referenced from CLIENT code is inlined into the browser bundle at
# BUILD time — setting it in .env.production at runtime does nothing. These two
# are the only such vars (GA in _app.tsx, CDN in cdnUrl.ts/_document.tsx); the
# other NEXT_PUBLIC_ vars are read only in API routes, where runtime env works.
# Both are unset in production today, so the default empty value matches current
# behaviour: no analytics tag, assets served from the app's own origin.
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=""
ARG NEXT_PUBLIC_CDN_URL=""
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=${NEXT_PUBLIC_GA_MEASUREMENT_ID}
ENV NEXT_PUBLIC_CDN_URL=${NEXT_PUBLIC_CDN_URL}
# Build-only placeholders, inlined on the command so they never persist as image
# ENV. `next build` imports route modules whose top-level code reads these; every
# client connects lazily, so no real service is touched. Real values come from
# .env.production at runtime (compose env_file).
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    NEXTAUTH_SECRET="build-placeholder-not-used-at-runtime" \
    NEXTAUTH_URL="http://localhost:3000" \
    npm run build

# The webpack cache is traced INTO .next/standalone and is pure build-time
# scratch — on this repo it is ~870MB, an order of magnitude larger than
# everything else in the image combined. amplify.yml strips it for the same
# reason. Nothing at runtime reads it.
RUN rm -rf .next/cache .next/standalone/.next/cache

# --- runner: standalone output only, no node_modules install ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# `output: "standalone"` emits a self-contained server.js plus only the traced
# node_modules. `static` and `public` are NOT included in it and must be copied
# separately — Caddy proxies everything, so the app serves its own assets.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
