# Copper & Cloves

Platform for **The Studio by Copper + Cloves**, a wellness studio in India that runs fitness classes, a plant-based café and a boutique. One Next.js app serves the public marketing site and every portal the studio needs to operate: members book and pay, instructors run check-in, partner brands manage their own classes, and admins run schedule, members, money and reporting.

> "Your home away from home." The public site is the brand voice; the portals are the hands. Both share one warm, earthy design system (sage, terracotta, cream, sand; Playfair Display + Montserrat).

## Who uses it

| Audience | Where | What they do |
|---|---|---|
| Public visitors | `/`, `/classes`, `/cafe`, `/rental`, `/shop`, `/founder`, `/meal-subscription` | Discover the studio, enquire about rentals, join waitlists, shop |
| Members | `/portal/*` | Book classes, buy passes, order café food, track streaks and badges |
| Instructors | `/instructor/*` | Weekly rosters, member check-in, self check-in |
| Partners | `/partner/*` + Partner API | Outside brands (e.g. Physique 57) running their own classes in the studio |
| Admins | `/admin/*` | Schedule, members, finance, payouts, reports, CRM, café and boutique |

Everyone signs in at one `/login`. An email can hold a separate login (own password) per portal; the picker shows which portals that email can enter.

## Features

**Members**
- Class booking with guests and group bookings (invite other members)
- Class and studio passes, time-bound special offers, stackable coupons
- Booking detail with timeline, cancellation preview, refund requests, PDF invoices
- Pass pause via support ticket, automatic resume
- Streaks, attendance stats, path-to-mastery and custom badges
- Café ordering (pass-holder discounts), boutique, meal subscriptions
- Reminder email ~1h before class

**Payments**
- Razorpay checkout (INR, paise) with booking-first flow: seat held 60 min as `payment_pending`
- Layered recovery so a paid member always gets what they paid for: HMAC verify, webhook, hourly pull reconciler, abandoned-checkout recovery email
- Offline payments (cash, Pine Labs card/UPI, direct UPI) with proof upload
- One unified `Payment` ledger across every method

**Instructors**
- Today/week rosters, member check-in, instructor self check-in window
- Unpaid attendees flagged with a reminder action

**Partners**
- Scoped portal: calendar, rosters, confirm/reject pending bookings, brand settings
- Server-to-server API with keys (`ccp_…`), docs at [`/partner-api.html`](public/partner-api.html)
- Signed booking webhooks (outbox via Postgres trigger, retries with backoff, admin test/retry)

**Admins**
- Schedule management with time-based edit lock (roster stays editable)
- Member management: assign, adjust, upgrade or remove passes; credits; tickets
- Class, instructor and member reports (trends, heatmaps, return rate, at-risk members)
- Finance ledger with Excel export, stuck-payment reconcile and import
- Instructor payouts: tiered rate card, GST, per-period overrides, frozen-on-paid snapshot
- CRM: email + WhatsApp templates, triggers, message log
- Badges, café menu, boutique products, partners, cron-health panel

Full client-facing feature list: [`FEATURES.md`](FEATURES.md).

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (Pages Router, Turbopack), React 19, TypeScript |
| Database | PostgreSQL 16 via Prisma 7 (`client` engine, `@prisma/adapter-pg`) |
| Auth | NextAuth 4, credentials + JWT sessions, role-scoped |
| Payments | Razorpay |
| Messaging | Gmail SMTP (primary), Resend (fallback), WhatsApp Cloud API |
| Storage | AWS S3 (presigned uploads) |
| UI | Tailwind CSS v4, shadcn/ui + Radix, framer-motion |
| Hosting | EC2 + Docker Compose: Caddy, pgbouncer, `web`, `cc-cron`; RDS Postgres |

## Quick start

```bash
cp .env.example .env.local   # fill in values, see docs/getting-started.md
npm install
npm run docker:db:up         # Postgres 16 on localhost:5433
npm run db:push              # sync schema
npm run db:seed:admin        # create an admin login
npm run dev:next             # http://localhost:3000
```

## Documentation

| Doc | Contents |
|---|---|
| [Getting started](docs/getting-started.md) | Setup, env vars, seeds, scripts, tests |
| [Architecture](docs/architecture.md) | Request paths, auth, domain model, project layout |
| [Payments](docs/payments.md) | Razorpay flow, booking-first checkout, reconciliation, offline payments |
| [Operations](docs/operations.md) | Deployment, cron jobs, database access, troubleshooting |
| [Partner API](public/partner-api.html) | OpenAPI spec for partner integrations |
| [Production runbook](deployment/prod/RUNBOOK.md) | Box-level runbook |

## License

BSD 3-Clause. See [LICENSE](LICENSE).
