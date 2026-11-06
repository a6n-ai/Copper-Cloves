# Architecture

## Overview

A single Next.js (Pages Router) app. Pages render UI; `src/pages/api/*` holds every backend route. Postgres via Prisma is the only datastore. Background work runs as HTTP endpoints under `/api/cron/*`, called on a schedule by a cron container.

```
Browser ──► Caddy ──► web (Next.js) ──► pgbouncer ──► RDS Postgres
                         ▲
cc-cron (busybox crond) ─┘  GET /api/cron/* with x-cron-secret
                         │
                         ├──► Razorpay      (orders, verify, webhooks)
                         ├──► Gmail/Resend  (email)
                         ├──► WhatsApp API  (template messages)
                         ├──► S3            (avatars, payment proofs)
                         └──► Partner URLs  (signed webhooks)
```

## Project layout

```
src/
  pages/              UI pages + API routes (pages/api/)
  components/         shared UI; admin/ for admin-only
  components/ui/      shadcn primitives (generated)
  components/responsive/  mobile primitives
  lib/                server + shared logic (payments, reports, payouts, auth)
  services/           client-side fetch wrappers
  contexts/ hooks/
  generated/prisma/   Prisma client (generated)
prisma/               schema.prisma, raw SQL triggers
scripts/              seeds, backfills, tests, one-off tools
deployment/           Dockerfile, prod compose, cron, Caddy, pgbouncer
public/               static assets, partner API spec
```

## Portals and routes

| Area | Pages | Gate |
|---|---|---|
| Public | `/`, `/classes`, `/cafe`, `/rental`, `/shop`, `/shop/[id]`, `/founder`, `/meal-subscription`, `/policy`, `/terms` | none |
| Login | `/login` (all roles), `/portal/signup` | none |
| Member | `/portal/dashboard`, `/book`, `/bookings`, `/bookings/[id]`, `/packages`, `/profile`, `/menu` | role `user` |
| Instructor | `/instructor/dashboard` | role `instructor` + `instructor_id` |
| Partner | `/partner/dashboard`, `/classes`, `/settings` | role `partner` + `partner_id` |
| Admin | `/admin/dashboard`, `/schedule`, `/members`, `/credits`, `/badges`, `/cafe`, `/products`, `/CRM`, `/control`, `/partners`, `/manual-entries` | role `admin` |

## Auth

1. `/login` step 1: `POST /api/auth/login-roles` with the email returns the roles it can sign in as.
2. If more than one, the user picks a portal.
3. `signIn("credentials", { email, password, role })`. `authorize()` finds the `Profile` by `(email, role)` and bcrypt-compares.
4. JWT carries `id`, `role`, `partner_id`, `instructor_id`. Server pages read it through `getStudioServerSession()`.

Partner API calls can instead send `Authorization: Bearer ccp_…`. Keys are stored as sha256 hashes, rate-limited to 120 req/min, and a bad bearer fails closed (no cookie fallback).

## Domain model

| Entity | Role |
|---|---|
| `Profile` | Every login. `@@unique([email, role])` |
| `ClassModel` / `ClassSchedule` | Class template / dated instance. Optional `partner_id` |
| `Booking` | A member's seat. Status: `confirmed`, `payment_pending`, `expired`, `cancelled`. Holds finance snapshot and guest count |
| `Package` / `UserPackage` | Pass definition / a member's pass with remaining credits and expiry |
| `RazorpayOrder` / `RazorpayPayment` | Gateway records (paise) |
| `Payment` | Unified ledger across online and offline methods |
| `Instructor` + `PayoutSettings` | Instructor link to login profile; payout rate card |
| `Partner`, `PartnerMember`, `PartnerApiKey`, `PartnerWebhook`, `PartnerWebhookEvent` | Partner brand, managers, keys, webhook outbox |
| `CafeItem` / `CafeOrder`, `RetailProduct` / `RetailOrder`, `MealSubscription` | Café, boutique, meal plans |
| `Coupon` / `CouponRedemption` | Promo codes scoped by `applies_to` |
| `UserStats`, `UserStreak`, `UserBadge`, `BadgeTemplate` | Gamification |
| `CrmTemplate`, `CrmTrigger`, `CrmMessage` | Email + WhatsApp CRM |
| `MemberTicket` | Pause and support requests |
| `CronRun` | One row per cron execution, used for health |

## Shared status rules

Status filters drifted across surfaces in the past, so they are centralised:

- `src/lib/bookingStatus.ts`: `HISTORY_STATUSES` (every history list), `ROSTER_STATUSES` (every roster), `REVENUE_STATUSES` (money and attendance counts), `OCCUPYING_STATUSES` (seat counts and duplicate checks).
- `src/lib/scheduleStatus.ts`: hidden statuses, locked statuses, and `deriveScheduleState()` for time-based upcoming/live/completed.

Use these instead of writing new status filters.

## Key engines

| Module | What |
|---|---|
| `src/lib/razorpayPersistence.ts` | Order/payment persistence, fulfilment, stuck-order reconciler |
| `src/lib/payoutCalc.ts` | Instructor payout math |
| `src/lib/classReport.ts`, `memberReport.ts` | Pure report engines behind the admin dashboard |
| `src/lib/partnerWebhooks.ts` | Webhook signing and delivery (SSRF-guarded) |
| `src/lib/partnerAuth.ts` | Partner session/API-key auth |
| `src/lib/cronAuth.ts` | Shared cron authorisation |
