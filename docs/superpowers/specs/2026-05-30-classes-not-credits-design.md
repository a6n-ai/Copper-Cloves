# Design: Collapse "credits" → "classes", single source of truth

Date: 2026-05-30
Status: Approved (pending spec review)

## Problem

Members see **different class/credit counts in different screens**, and a user's
pass sometimes shows as the wrong category (class pass vs studio pass).

Two root causes:

1. **Two columns track the same number.** `UserPackage.credits_remaining` and
   `UserPackage.classes_remaining` are both populated on create, but only
   `credits_remaining` is ever decremented (booking, check-in) or incremented
   (cancel/reject refund). `classes_remaining` stays frozen at the purchased
   count. Any screen that reads `classes_remaining` (directly or via a
   `credits_remaining ?? classes_remaining` fallback) shows a stale number.

2. **Pass category is computed four different ways.** A correct helper
   `passCategoryForPackageType()` exists in `src/lib/couponHelpers.ts`, but
   `admin/members.tsx`, `admin/dashboard.tsx`, and `admin/control.tsx` each
   hand-roll their own logic off stale `pass_type` snapshots that disagree,
   causing class↔studio flips.

## Domain model (authoritative)

- **Studio pass** = unlimited classes. No count. Valid while inside its date
  window. Represented by `credits_remaining = null`. UI shows **"Unlimited"**.
- **Class pass** = a finite number of classes (added by admin or bought by the
  member). Decrements per attended class. UI shows **"N classes left"**.
- The word **"credits" is retired** from the product vocabulary — everything is
  **classes**. (DB column `credits_remaining` is kept physically; only the
  user-visible wording changes. See Decisions.)

## Decisions (locked with user)

1. **Drop `classes_remaining` entirely.** It is the redundant, drifting column.
   `credits_remaining` (the live, decremented one) becomes the single source of
   truth; `credits_total` holds the pass's original class count.
2. **Relabel "credits" → "classes" everywhere**, member-facing *and* admin
   (incl. the `/admin/credits` ledger page and member Manage dialog).

## Approach

### Part A — Drop the redundant column (data-safe order)

`classes_remaining` is referenced in 11 sites (see Appendix). Order of work:

1. **Backfill first (prod-safe).** Before removing the column, ensure no live
   data lives *only* in `classes_remaining`. Script:
   `scripts/backfill-classes-remaining.ts` —
   for every **class pass** `UserPackage` where `credits_remaining IS NULL` and
   `classes_remaining IS NOT NULL`, set `credits_remaining = classes_remaining`
   (and `credits_total = COALESCE(credits_total, classes_remaining)`).
   Studio passes (unlimited) are left with `credits_remaining = null`.
   Idempotent; must `process.exit(0)` (one-shot tsx scripts hang otherwise).
2. **Stop writing it.** Remove `classes_remaining` from the create payloads in
   `user-packages.ts`, `admin/users.ts`, `razorpayServerCheckout.ts`,
   `seed-member-users.ts`, and the `select` in `adminDashboardSections.ts`.
3. **Stop reading it.** Replace every `... ?? classes_remaining` fallback with
   just `credits_remaining` (studio pass → render "Unlimited", not a number):
   `admin/dashboard.tsx:1133`, `admin/control.tsx:704` (+ drop the field from
   its local type at `:647`), `admin/credit-transactions.ts:61`,
   `adminDashboardSections.ts:553`.
4. **Remove from schema.** Delete line `prisma/schema.prisma:341`, then
   `db:generate`. **`db:push` is run by the user** (targets prod RDS) after
   the backfill has run and been verified — not by Claude.

### Part B — One category function everywhere

Replace the hand-rolled category logic in `admin/members.tsx` (~`:428-437`),
`admin/dashboard.tsx` (~`:1132`), and `admin/control.tsx` with
`passCategoryForPackageType(packageType)`, deriving from the row's
`PackageType` rather than the stored `pass_type` snapshot. The helper already
falls back to `is_unlimited` for legacy `type:"standard"` rows, so portal
purchases (which write `type:"standard"`) still classify correctly.

No change to `passCategoryForPackageType` itself — it is already correct.
(Optional, low-risk: `portal/packages.tsx:569` could write the real category
instead of `"standard"`, but the helper makes this unnecessary; leave as-is to
keep the diff focused.)

### Part C — Relabel UI wording

Change user-visible "credit(s)" strings to "class(es)" in: `portal/dashboard`,
`portal/book`, `portal/packages`, `portal/bookings`, `admin/members`,
`admin/dashboard`, `admin/control`, `admin/credits`, `admin/CRM`. Studio passes
render **"Unlimited"**; class passes render **"N classes left"**. Identifiers
and the DB column stay `credits_*`; only display text changes.

## Testing

No unit-test runner exists today (only Playwright e2e). **Decision: add
`vitest`** as a dev dependency with a `test:unit` script, scoped to pure logic.

- `passCategoryForPackageType` gets a table-driven test: studio_pass / class_pass
  / `standard`+unlimited / `standard`+finite / empty `type` / null inputs.
- The backfill decision rule is extracted into a pure function
  (`shouldBackfillCredits(pkg) → number | null`) and unit-tested: class pass with
  null `credits_remaining` → fills from `classes_remaining`; studio pass → stays
  null; already-set `credits_remaining` → untouched.
- TDD: write each test first, watch it fail, then implement.
- Manual e2e (still required): a class-pass member and a studio-pass member each
  viewed across portal dashboard, admin dashboard, admin members, admin control —
  counts and category must match on every screen.

## Risks

- **Prod column drop is destructive.** Mitigated by backfill-first + user runs
  `db:push`. Verify backfill output before the drop.
- **Hidden reads of `classes_remaining`** outside the grep (e.g. raw SQL, JSON
  blobs). Searched `src` excluding generated; none found beyond the 11 listed.

## Appendix — `classes_remaining` reference sites

| File | Line | Action |
|---|---|---|
| `prisma/schema.prisma` | 341 | delete field |
| `src/pages/api/user-packages.ts` | 123 | stop writing |
| `src/pages/api/admin/users.ts` | 136 | stop writing |
| `src/lib/razorpayServerCheckout.ts` | 325 | stop writing |
| `scripts/seed-member-users.ts` | 258 | stop writing |
| `src/lib/adminDashboardSections.ts` | 509, 553 | drop from select + read |
| `src/pages/admin/dashboard.tsx` | 1133 | read `credits_remaining` only |
| `src/pages/admin/control.tsx` | 647, 704 | drop type field + read |
| `src/pages/api/admin/credit-transactions.ts` | 61 | use `credits_total`/`credits_remaining` |
