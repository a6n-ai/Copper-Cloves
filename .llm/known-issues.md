# Known Issues

## 1. Duplicate streak tracking models

`UserStats` and `UserStreak` both track streak data (`current_streak`, `longest_streak`, `last_class_date`). `UserStats` also has `total_classes_attended`. Separate tables, overlapping responsibility, no sync — can diverge.

- **File:** `prisma/schema.prisma` lines 440–467
- **Risk:** Portal dashboard and admin overview may show different streak values if one table updates but not other.
- **Fix:** Merge into one model or document authoritative one and add guard in `bookingAttendance.ts`.

## 2. Webhook fulfillment is best-effort only

`tryFulfillCheckoutAfterWebhook` in `src/lib/razorpayPersistence.ts` (line 322) swallows errors with `console.error`. If `fulfillCheckoutFromPaidOrder` fails (DB deadlock, package already claimed), webhook returns 200 but no retry triggers.

- **Risk:** Payment captured but booking/package not fulfilled — member paid, gets nothing.
- **Fix:** Add dead-letter queue or at minimum `fulfillment_failed` flag on `RazorpayOrder` for admin review.

## 3. Finance snapshot `snapshotTotalsConsistent` uses tax-inclusive math — old bookings will mismatch

`src/lib/financeBookingCheckout.ts` `snapshotTotalsConsistent` updated to expect tax-inclusive prices (`total = sub`, not `sub * 1.05`). Old bookings stored with exclusive-tax snapshots read as inconsistent if re-validated.

- **Risk:** Webhook re-fulfillment of old paid orders may fail consistency guard.
- **Fix:** Guard only hit on new bookings; old orders use direct DB lookup path. Low risk.

## 4. `BookingReconcile` no-show logic not verified for multi-guest bookings

`src/lib/bookingReconcile.ts` — no-show reconciliation marks entire booking `no_show` but `extra_guest_count` on `Booking` means one row = multiple people. Finance snapshots (`finance_snapshot` JSON) may miscalculate for partial attendance.

- **File:** `src/lib/bookingReconcile.ts`
- **Risk:** Instructor payout calculations (use check-in data) may undercount multi-guest revenue.

## 4. `PackageType` vs `Package` dual models

Two models, similar roles: `PackageType` (older, purchase flows) and `Package` (newer, `validity_days` / `credits_total`). `UserPackage` links both via separate FK columns. No constraint prevents `UserPackage` with neither or both set.

- **File:** `prisma/schema.prisma` lines 192–255
- **Risk:** New purchase code may write wrong model; admin UI and member portal may disagree on available packages.
- **Fix:** Deprecate `PackageType`, migrate all flows to `Package`, or add DB-level constraint.

## 5. Inline pass purchase in booking flow (`handleAddPass`) reuses avatar presign endpoint for attachments

`src/pages/portal/profile.tsx` support ticket attachment upload calls `/api/user/avatar-presign` — scoped to avatar images. Returns 200 but stores doc under avatar S3 prefix, not doc prefix.

- **Risk:** No functional breakage; semantic mismatch. S3 bucket gets support docs mixed with profile photos.
- **Fix:** Create `/api/user/doc-presign` with separate S3 key prefix (`support-docs/`).

## 6. `tsconfig` + Next.js build errors silenced

`next.config.mjs` has `typescript: { ignoreBuildErrors: true }` and `eslint: { ignoreDuringBuilds: true }`. Type errors won't fail CI.

- **Risk:** Regressions invisible until runtime.
- **Fix:** Re-enable once type errors resolved.

## 7. `STUDIO_DATABASE_URL` workaround for Windows

`src/lib/database-url.ts` reads `STUDIO_DATABASE_URL` before `DATABASE_URL` to avoid Windows host override. Non-obvious — new DB connection utilities must use same pattern or connections fail on Windows.