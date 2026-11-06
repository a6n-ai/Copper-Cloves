# Getting started

## Prerequisites

- Node 22
- Docker (for the local Postgres container)

## Setup

```bash
cp .env.example .env.local
npm install
npm run docker:db:up      # Postgres 16 on host port 5433
npm run db:push           # sync prisma/schema.prisma to the DB
npm run db:seed:admin     # ensure an admin login exists
npm run dev:next          # Next.js on http://localhost:3000
```

`npm run dev` does both (starts the DB container, then Next.js). `npm run dev:fresh` clears `.next` first. `npm run check:env` reports missing env vars.

> `.env.local` may point at the production RDS instance. Prod RDS is private, so commands against it need an SSH tunnel (see [Operations](operations.md#database-access)). For local work, point `DATABASE_URL` at `localhost:5433`.

## Environment variables

Full list lives in `.env.example`. The important ones:

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Prisma connection string |
| `STUDIO_DATABASE_URL` | Takes precedence over `DATABASE_URL` (Windows host-env workaround) |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | Auth origin + JWT signing secret |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Server-side Razorpay |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Client Checkout key, same mode as server key |
| `RAZORPAY_WEBHOOK_SECRET` | HMAC verify for the Razorpay webhook |
| `EMAIL_USER` / `EMAIL_PASS` / `EMAIL_FROM` | Gmail SMTP |
| `RESEND_API_KEY` | Email fallback |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Cloud API |
| `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_REGION` | Uploads (`S3_*`, not `AWS_*`) |
| `CRON_SECRET` | `x-cron-secret` header for `/api/cron/*` |
| `ADMIN_SETUP_SECRET` | One-time `POST /api/setup/bootstrap-admin` |

Without S3 configured, uploads fall back to `public/uploads/`.

## Database

```bash
npm run db:generate   # regenerate Prisma client after schema change
npm run db:push       # push schema to the DB
npm run db:studio     # Prisma Studio
```

- Schema: `prisma/schema.prisma`; client generated into `src/generated/prisma/` (do not edit).
- Import the singleton: `import prisma from "@/lib/prisma"`. Never `new PrismaClient()` elsewhere.
- Postgres triggers (partner webhooks) live in `prisma/sql/` and are applied by `npm run ci:db-push`, not `db:push`.

## Seeds and backfills

```bash
npm run db:seed:admin             # admin login
npm run db:seed:instructors       # instructor roster
npm run db:seed:members           # sample members with packages
npm run db:seed:payout-settings   # default payout rate card
npm run db:seed:crm-system        # CRM email templates
npm run db:seed:crm-triggers      # CRM triggers
npm run backfill:completed-schedules
npm run backfill:expire-passes
```

All are idempotent and run with `tsx`.

## Lint and tests

```bash
npm run lint                  # ESLint flat config (next build no longer lints)
npx tsc --noEmit              # typecheck; tsconfig is strict:false, so run this after refactors
npm run test:payout           # payout engine
npm run test:class-report     # class + instructor reports
npm run test:member-report    # member report
npm run test:partner-webhooks # webhook delivery
```

Tests are small assert-based `tsx` scripts, one per area (`npm run test:*`). Run the ones for the area you changed; CI runs the rest.

## Conventions worth knowing

- Money is always **paise** (`Int`) for Razorpay, `Decimal(10,2)` elsewhere. Never floats.
- Profile email is unique **per role**, not globally. Look up with `findFirst({ email, role })`.
- Server pages use `getStudioServerSession()`; admin routes call `requireAdmin(session)` first.
- shadcn components in `src/components/ui/` are generated. Mobile primitives (`ResponsiveDialog`, `ResponsiveTable`, `Container`) live in `src/components/responsive/`.
- Changing a `/api/partner/*` contract means updating `public/partner-api.json` in the same commit.
