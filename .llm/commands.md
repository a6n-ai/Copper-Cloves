# Commands

## Dev

```bash
npm run dev           # docker db up + Next.js on http://localhost:3000 (Turbopack)
npm run dev:next      # Next.js only (db must already be running)
npm run docker:db:up  # start Postgres 16 container on port 5433
npm run docker:db:down
```

## Build

```bash
npm run build         # prisma generate + next build
npm start             # serve production build
```

## Lint

```bash
npm run lint          # next lint (ESLint flat config, next/core-web-vitals + next/typescript)
```

No formatter (Prettier not in deps). Stylelint via `.stylelintrc.json` for CSS.

## Database

```bash
npm run db:generate           # prisma generate (re-generate client after schema change)
npm run db:push               # prisma db push (sync schema → local docker db)
npm run docker:db:push        # db push inside docker network
npm run ci:db-push            # CI variant (node scripts/ci-db-push.mjs)
npm run db:studio             # Prisma Studio GUI on default port
```

Schema: `prisma/schema.prisma`. Client output: `src/generated/prisma/`.

## Seeds

```bash
npm run db:seed:admin             # ensure admin user exists
npm run db:seed:instructors       # seed instructor roster
npm run db:seed:weekend-may-2026  # seed May 2026 weekend class schedules (manual; removed from amplify auto-deploy)
npm run db:seed:members           # seed 6 studio members with packages + login
npm run db:seed:payout-settings   # seed default instructor payout rate card (idempotent)
npm run backfill:completed-schedules   # flip past-due class_schedules → completed/abandoned (idempotent)
```

## Tests

```bash
npm run test:payout   # assert-based unit tests for payout engine (tsx)
```

## Scheduler (PM2 cron)

```bash
npm run scheduler   # node-schedule loop: class-emails */5m + schedule-lifecycle */30m + lifecycle-bookings */15m
```

Long-running process under PM2 (`ecosystem.config.js`). `schedule-lifecycle` runs `advanceCompletedSchedules` (status flips). `razorpay-reconcile` hourly runs `reconcileStuckRazorpayOrders` (fulfill paid-but-stuck orders). Serverless alt: external scheduler → `/api/cron/class-emails` + `/api/cron/reconcile-no-shows` + `/api/cron/reconcile-razorpay`.

## Required env vars (see `.env.example`)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Prisma connection string |
| `STUDIO_DATABASE_URL` | Fallback when host `DATABASE_URL` overrides on Windows |
| `NEXTAUTH_URL` | Full origin (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | JWT signing secret |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Server-side Razorpay |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Client Checkout script (must match server key mode) |
| `RAZORPAY_WEBHOOK_SECRET` | HMAC verify for `/api/payments/razorpay/webhook` |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail SMTP (Option A) |
| `RESEND_API_KEY` | Resend (Option B fallback) |
| `EMAIL_FROM` | From address for outbound email |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Cloud API |
| `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_REGION` | S3 uploads (renamed from `AWS_*` to avoid Amplify reserved namespace) |
| `S3_PUBLIC_URL` | Optional override for public bucket URL |
| `ADMIN_SETUP_SECRET` | One-time bootstrap via POST `/api/setup/bootstrap-admin` |
| `CRON_SECRET` | Shared secret for `/api/cron/*` endpoints (header `x-cron-secret`) |