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
npm run db:seed:weekend-may-2026  # seed May 2026 weekend class schedules
npm run db:seed:members           # seed 6 studio members with packages + login
```

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
| `AWS_S3_BUCKET` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 avatar uploads |
| `ADMIN_SETUP_SECRET` | One-time bootstrap via POST `/api/setup/bootstrap-admin` |