# Architecture

## What it does

Copper & Cloves — Next.js 15 studio platform for fitness/wellness studio (The Studio by C&C). Members book classes, buy packages, order café food, shop boutique. Admins manage schedule, members, CRM, retail, finances.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (Pages Router), React 18, TypeScript |
| DB | PostgreSQL 16 (Docker local, hosted prod) via Prisma 7 ORM |
| Auth | NextAuth 4 — credentials only, JWT sessions, role in token |
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

### Member portal (`/portal/*`)
Auth gated via `getStudioServerSession` → redirect to `/portal/login`.

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
Auth gated + `requireAdmin` check (`role === "admin"`).

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

### API routes (`/api/*`)

| Route | Purpose |
|---|---|
| `/api/auth/[...nextauth]` | NextAuth signin/signout |
| `/api/auth/signup` | New member registration |
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
| `/api/admin/*` | Other admin-only data endpoints |
| `/api/meal-subscriptions` | Meal subscription management |
| `/api/meal-subscription-inquiries` | Waitlist form submissions |
| `/api/rental-inquiries` | Space rental contact form |
| `/api/activity/events` | Client-side activity tracking |
| `/api/upload` | Generic file upload |
| `/api/setup/bootstrap-admin` | One-time admin seeding (secret header) |

## Domain entities

| Entity | Purpose |
|---|---|
| `Profile` | All users (members + admin). `role` = `"user"` \| `"admin"` |
| `ClassModel` | Class type template (name, category, duration, capacity) |
| `ClassSchedule` | Specific dated instance of class |
| `Booking` | Member claim on ClassSchedule slot; holds finance snapshot + guest slots |
| `Package` | Purchasable pass definition (credits, validity) |
| `PackageType` | Legacy pass type (older purchase flows) |
| `UserPackage` | Member's active pass; tracks `credits_remaining` / `classes_remaining` |
| `RazorpayOrder` | One Razorpay `order_*` per checkout; amounts in paise |
| `RazorpayPayment` | One `pay_*` per payment attempt; HMAC-verified flag |
| `CafeItem` / `CafeOrder` | Studio café menu + per-booking or standalone orders |
| `RetailProduct` / `RetailOrder` | Boutique product catalog + purchase orders |
| `MealSubscription` | Monthly meal plan; `meals_remaining` decrements per order |
| `Coupon` / `CouponRedemption` | Promo codes; `applies_to`: `food` \| `ecommerce` \| `class_pass` \| `studio_pass` |
| `Instructor` | Studio instructors; `studio_payout_cut_percent` not public |
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

1. `POST /api/auth/callback/credentials` → NextAuth `authorize()` → bcrypt compare vs `profile.hashedPassword`
2. JWT issued; `role` embedded in token
3. Server pages call `getStudioServerSession()` → wraps `getServerSession(authOptions)`
4. Admin pages call `requireAdmin(session)` → throws/redirects on `role !== "admin"`

## Razorpay checkout flow

1. Client calls `POST /api/payments/razorpay/create-order` → returns `razorpay_order_id`
2. `persistRazorpayOrderOnCreate` writes `RazorpayOrder` row (status `created`)
3. Razorpay Checkout opens in browser (web standard or redirect via `callback-redirect`)
4. Success → client calls `POST /api/payments/razorpay/verify-payment` → HMAC verify → `persistVerifiedRazorpayPayment`
5. `POST /api/payments/razorpay/finish-checkout` links order to booking/package
6. Webhook at `/api/payments/razorpay/webhook` reconciles out-of-order events; can trigger `fulfillCheckoutFromPaidOrder` as backup