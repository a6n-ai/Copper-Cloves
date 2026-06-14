# Architecture

## What it does

Copper & Cloves — Next.js 15 studio platform for fitness/wellness studio (The Studio by C&C). Members book classes, buy packages, order café food, shop boutique. Admins manage schedule, members, CRM, retail, finances.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (Pages Router), React 18, TypeScript |
| DB | PostgreSQL 16 (Docker local, hosted prod) via Prisma 7 ORM |
| Auth | NextAuth 4 — credentials only, JWT sessions. Unified `/login` for all roles. Token holds `role` + `partner_id` + `instructor_id` |
| Payments | Razorpay (INR, paise units) |
| Email | Gmail SMTP (primary) → Resend (fallback) |
| Notifications | WhatsApp Cloud API (template messages) |
| Storage | AWS S3 (avatar uploads, presigned URLs) |
| Hosting | Vercel / AWS Amplify (both have config) |
| UI | shadcn/ui + Radix + Tailwind CSS |
| Deployment | PM2 (`ecosystem.config.js`) + Docker Compose for local DB |

## Request paths

### Public pages
`/` `/classes` `/cafe` `/rental` `/shop` `/shop/[id]` `/policy` `/terms` `/founder` `/meal-subscription`

### Unified login (`/login`)
Single sign-in for every role. Step 1: enter email → `POST /api/auth/login-roles` returns the roles that email has. Step 2: if >1 role, pick portal; else skip. Step 3: password → `signIn("credentials", { email, password, role })` → redirect by role (admin→`/admin/dashboard`, partner→`/partner/dashboard`, instructor→`/instructor/dashboard`, user→`/portal/dashboard`). Old `/{admin,portal,instructor,partner}/login` all 307-redirect to `/login`. Signup still at `/portal/signup`.

### Member portal (`/portal/*`)
Auth gated via `getStudioServerSession` → redirect to `/login`.

| Page | Purpose |
|---|---|
| `/portal/dashboard` | Stats, streaks, badges |
| `/portal/book` | Browse + book class schedules |
| `/portal/bookings` | View/cancel bookings |
| `/portal/packages` | Buy class packages |
| `/portal/profile` | Update profile, avatar upload |
| `/portal/menu` | Café order |
| `/portal/payment/razorpay-return` | Post-checkout landing |

### Admin (`/admin/*`)
Auth gated + `requireAdmin` check (`role === "admin"`). `/admin` (no path) server-side redirects to `/admin/dashboard`.

| Page | Purpose |
|---|---|
| `/admin/dashboard` | Revenue, class, member overview |
| `/admin/schedule` | Create/edit class schedules |
| `/admin/members` | Member list, credits, package assignment |
| `/admin/credits` | Credit transactions |
| `/admin/badges` | Path-to-mastery + custom badge management; allocate to members |
| `/admin/cafe` | Café item management + order view |
| `/admin/products` | Boutique product management |
| `/admin/CRM` | CRM templates, triggers, message log |
| `/admin/control` | Analytics panel, raw activity data |
| `/admin/partners` | Manage outside-client partners; create partner + manager login, assign classes |

### Partner portal (`/partner/*`)
Outside clients renting the studio (e.g. Physique 57) who run their own classes. Chrome via `PartnerNavigation` (sidebar sections Dashboard/Operations/System). Gated: session role `partner` + `partner_id`. Scoped to classes where `ClassModel.partner_id` = their partner.

| Page | Purpose |
|---|---|
| `/partner/dashboard` | Stats + today's classes |
| `/partner/classes` | Week/month calendar, rosters, confirm/reject pending bookings |
| `/partner/settings` | Edit partner brand (name, logo, description) + own login email/phone |

### Instructor portal (`/instructor/*`)
Gated: session role `instructor` + `instructor_id`. `/instructor/dashboard` — today/week classes, member check-in, instructor self check-in window.

### API routes (`/api/*`)

| Route | Purpose |
|---|---|
| `/api/auth/[...nextauth]` | NextAuth signin/signout; `authorize` keys on (email, role) |
| `/api/auth/login-roles` | POST `{email}` → roles that email can sign in as (powers `/login` picker) |
| `/api/auth/signup` | New member registration (role `user`) |
| `/api/auth/forgot-password` / `reset-password` | Member (role `user`) password reset via emailed token |
| `/api/partner/profile` | GET/PATCH signed-in partner's brand + own login email/phone |
| `/api/partner/classes` | Partner-scoped class list |
| `/api/partner/booking-action` | Confirm/reject pending partner-class bookings |
| `/api/admin/partners` | CRUD partners + manager logins; assign/unassign classes |
| `/api/instructor/today-classes` | Instructor's week rosters (NextAuth session) |
| `/api/instructor/check-in` / `instructor-check-in` | Member check-in / instructor self check-in |
| `/api/bookings` | CRUD bookings, check-in, guest slots |
| `/api/class-schedules` | List/create/update schedules |
| `/api/classes` | List/create/update class types |
| `/api/packages` | Package type catalog |
| `/api/user-packages` | Purchase + list member packages |
| `/api/user-stats` | Streaks, badges, class count |
| `/api/coupons/validate` | Coupon eligibility check |
| `/api/cafe/*` | Café items, orders, checkout |
| `/api/retail-products` | Boutique product list |
| `/api/retail/checkout` | Boutique order creation |
| `/api/payments/razorpay/create-order` | Create Razorpay order (paise) |
| `/api/payments/razorpay/verify-payment` | HMAC verify + persist payment |
| `/api/payments/razorpay/finish-checkout` | Fulfill booking/package after verify |
| `/api/payments/razorpay/webhook` | Razorpay event reconciliation |
| `/api/payments/razorpay/callback-redirect` | Redirect handler for native checkout |
| `/api/payments/razorpay/config-status` | Is Razorpay configured? |
| `/api/user/profile` | Get/update profile (name, phone, whatsapp_phone, dob, gender, questionnaire) |
| `/api/user/avatar-presign` | S3 presigned upload URL |
| `/api/user/change-password` | Change own password |
| `/api/user/support-tickets` | Member pause-subscription tickets (GET/POST) |
| `/api/user/badges` | Current user's earned badges |
| `/api/bookings/process-guests` | Post-booking: create accounts + send emails for guest attendees |
| `/api/admin/badges` | CRUD badge templates (path-to-mastery + custom) |
| `/api/admin/badge-allocations` | Allocate/revoke custom badges to members |
| `/api/admin/members-search` | Typeahead member search (name/email) |
| `/api/admin/backfill-stats` | Recompute streak/attendance stats for all users |
| `/api/admin/member-tickets` | View/update member pause-subscription tickets |
| `/api/admin/payments` | Record offline payment (cash, Pine Lab, direct UPI, etc.) with optional proof URL; lists by user_id |
| `/api/admin/dashboard/today-classes` | Today's class rosters with check-ins |
| `/api/admin/dashboard/expiring-members` | Members whose package expires in ≤14 days |
| `/api/admin/dashboard/class-performance` | Per-class booking volume + discipline split |
| `/api/admin/dashboard/instructor-performance` | Per-instructor classes, check-ins, rating |
| `/api/admin/dashboard/instructors-summary` | Instructor roster card data |
| `/api/admin/dashboard/member-stats` | Member-of-month, top class, no-show + late check-in counts, inactive users |
| `/api/admin/dashboard/member-list` | Recent package purchasers (24 most recent) |
| `/api/admin/dashboard/transactions` | Finance ledger (packages + booking checkouts) |
| `/api/admin/payout-settings` | Global payout rate card (12/8/4/1, GST, default cut) + `payable_basis` (`all_booked`\|`checked_in`\|`per_class`). GET/PUT, admin. UI: `/admin/manual-entries?tab=rate_settings` (live worked example). |
| `/api/admin/instructor-payouts` | Per-period payout per instructor. Only `started`+`completed` classes count. Payable units per `payable_basis`. ?instructorId= scopes to one. |
| `/api/admin/instructor-payout-detail` | Per-attendee ledger for one instructor/period (basis-aware row counts reconcile to payable units). Powers the instructor Payout tab. |
| `/api/admin/instructor-payout-adjustment` | Per-(instructor,period) overrides: blended-rate override, final override, mark-paid (freezes snapshot). |
| `/api/admin/*` | Other admin-only data endpoints |
| `/api/cron/reconcile-no-shows` | Header `x-cron-secret: $CRON_SECRET` (or admin session). Marks past-due bookings `no_show`. Schedule externally — no longer on request path. |
| `/api/cron/reconcile-razorpay` | Header `x-cron-secret: $CRON_SECRET` (or admin session). Backstop: polls Razorpay for paid-but-unfulfilled website orders → captures + fulfils. Covers mobile-closed-tab / missed webhook. Idempotent. `?hours=72&limit=200`. |
| `/api/cron/lifecycle-bookings` | Header `x-cron-secret`/admin. payment_pending booking lifecycle: ~30m recovery email + 60m seat release (after Razorpay confirms no capture). Every ~15m. |
| `/api/meal-subscriptions` | Meal subscription management |
| `/api/meal-subscription-inquiries` | Waitlist form submissions |
| `/api/rental-inquiries` | Space rental contact form |
| `/api/activity/events` | Client-side activity tracking |
| `/api/upload` | Generic file upload |
| `/api/setup/bootstrap-admin` | One-time admin seeding (secret header) |

## Domain entities

| Entity | Purpose |
|---|---|
| `Profile` | All login accounts. `role` = `"user"` \| `"instructor"` \| `"partner"` \| `"admin"`. **`@@unique([email, role])`** — email NOT globally unique; one person can have a separate login row (own password) per portal. Lookups by email use `findFirst` scoped by role, never `findUnique`. |
| `Partner` | Outside client running classes (name, slug, logo_url, description). Has `members PartnerMember[]` + `classes ClassModel[]` (via `ClassModel.partner_id`). No email/phone — those live on the manager's Profile. |
| `PartnerMember` | Join: Partner ↔ Profile (manager logins). `@@unique([partner_id, profile_id])`. Session `partner_id` resolved from here. |
| `ClassModel` | Class type template (name, category, duration, capacity) |
| `ClassSchedule` | Specific dated instance of class |
| `Booking` | Member claim on ClassSchedule slot; holds finance snapshot + guest slots |
| `Package` | Purchasable pass definition (credits, validity) |
| `PackageType` | Legacy pass type (older purchase flows) |
| `UserPackage` | Member's active pass; tracks `credits_remaining` / `classes_remaining` |
| `RazorpayOrder` | One Razorpay `order_*` per checkout; amounts in paise. Owns booking_id / user_package_id linkage. |
| `RazorpayPayment` | Gateway-native `pay_*` row only (amount, status, method, HMAC-verified flag). Ownership stripped — joins to `Payment` via `razorpay_payment_id`. |
| `Payment` | Unified payment ledger across all methods. Enum `PaymentMethod`: `razorpay_online` \| `razorpay_completed` \| `pine_lab_card` \| `pine_lab_upi` \| `direct_upi` \| `cash`. Owns `user_id`, `booking_id`, `user_package_id`, optional `proof_url`, `recorded_by` (admin), and FK to `RazorpayPayment` for online flows. |
| `CafeItem` / `CafeOrder` | Studio café menu + per-booking or standalone orders |
| `RetailProduct` / `RetailOrder` | Boutique product catalog + purchase orders |
| `MealSubscription` | Monthly meal plan; `meals_remaining` decrements per order |
| `Coupon` / `CouponRedemption` | Promo codes; `applies_to`: `food` \| `ecommerce` \| `class_pass` \| `studio_pass` |
| `Instructor` | Studio instructors; `studio_payout_cut_percent` not public. `profile_id` (`@unique`) links to the role `instructor` login Profile. Session `instructor_id` resolved from this link. Payout = tiered rate card (`PayoutSettings` singleton global + per-instructor `rate_*_paise` override) → per-class net (÷classes ÷(1+GST) ×instructorPct) → blended avg (editable per period) × payable units. Engine: `src/lib/payoutCalc.ts`. Frozen-on-paid snapshot. |
| `Waiver` | Signed liability waivers |
| `CrmTemplate` / `CrmMessage` / `CrmTrigger` | Internal CRM — email + WhatsApp |
| `UserStats` / `UserStreak` / `UserBadge` | Gamification: streak tracking, badges earned |
| `BadgeTemplate` | Admin-defined badge definitions; `badge_type` = `path_to_mastery` \| `custom`; `threshold_classes` for auto-award |
| `MemberTicket` | Member-raised support requests (pause subscription); status `open` \| `in_review` \| `resolved` |
| `UserActivitySession` / `UserActivityEvent` | Behavioural analytics (immutable log) |
| `MealSubscriptionInquiry` | Public waitlist from `/meal-subscription` page |
| `RentalInquiry` | Space rental contact form submissions |

## External dependencies

| System | Purpose |
|---|---|
| PostgreSQL 16 | Primary data store |
| Razorpay | INR payments (orders, verification, webhooks) |
| Gmail SMTP / Resend | Transactional email |
| WhatsApp Cloud API (Meta Graph) | Package purchase notifications (template messages) |
| AWS S3 | Avatar image storage; presigned PUT URLs |
| NextAuth | Session management (JWT, CredentialsProvider) |

## Auth flow

1. `/login` step 1: email → `POST /api/auth/login-roles` → roles for that email. Pick portal if >1.
2. `POST /api/auth/callback/credentials` with `{email, password, role}` → `authorize()` finds Profile by `findFirst({ email, role })` → bcrypt compare vs `profile.hashedPassword`. Role is authoritative on the row.
3. `authorize` also resolves scope ids: `partner_id` from `PartnerMember` (if role partner), `instructor_id` from `Instructor.profile_id` (if role instructor). JWT/session carry `id`, `role`, `partner_id`, `instructor_id`.
4. Server pages call `getStudioServerSession()` → wraps `getServerSession(authOptions)`.
5. Admin pages call `requireAdmin(session)` → throws/redirects on `role !== "admin"`. Partner/instructor APIs check `role` + their scope id (`partner_id` / `instructor_id`).

## Razorpay checkout flow

1. Client calls `POST /api/payments/razorpay/create-order` → returns `razorpay_order_id`
2. `persistRazorpayOrderOnCreate` writes `RazorpayOrder` row (status `created`)
3. Razorpay Checkout opens in browser (web standard or redirect via `callback-redirect`)
4. Success → client calls `POST /api/payments/razorpay/verify-payment` → HMAC verify → `persistVerifiedRazorpayPayment` (dual-writes `razorpay_payments` + `payments` row keyed on `razorpay_payment_id`)
5. `POST /api/payments/razorpay/finish-checkout` links order to booking/package (and updates `payments.booking_id` / `user_package_id`)
6. Webhook at `/api/payments/razorpay/webhook` reconciles out-of-order events; same dual-write; can trigger `fulfillCheckoutFromPaidOrder` as backup

## Offline payment flow (admin walk-ins)

1. Admin opens member's Manage dialog → Step 1 (pass config) → Step 2 (payment).
2. POST `/api/admin/payments` writes a `Payment` row with chosen `method`, amount in paise, optional `proof_url` (uploaded via `/api/upload`), `recorded_by` = admin id.
3. UI then calls `PATCH /api/admin/members` to apply pass config; endpoint auto-creates `UserPackage` if member has none.