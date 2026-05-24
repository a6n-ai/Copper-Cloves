# Consistent Loading States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ~57 ad-hoc `animate-spin` loaders across 28 files with one canonical shadcn `<Spinner>`, and add layout-matched skeletons on initial data load.

**Architecture:** Add `ui/spinner.tsx` (`Spinner` + `PageLoader`) as the single `animate-spin` source. Add `components/skeletons.tsx` with generic `GridSkeleton`/`FormSkeleton` (re-exporting existing `ListSkeleton`/`TableSkeleton`). Sweep files area-by-area: full-page page-load loaders → skeleton (layout known) or `<PageLoader/>` (gate); inline button/action loaders → `<Spinner className="mr-2 size-4"/>`.

**Tech Stack:** Next.js 15 (Pages Router), React 18, TypeScript, Tailwind, lucide-react, shadcn/ui, Playwright.

> **Verification model:** This is a UI refactor — no unit-test framework for components. "Tests" here = `npm run lint`, grep guards, and Playwright responsive smoke. Each sweep task ends with lint + the grep guard scoped to its files.
> **Commits:** Per repo owner preference, do NOT auto-commit. Commit steps are listed for grouping; run them only when the owner says so.

---

## File Structure

- Create `src/components/ui/spinner.tsx` — `Spinner` (canonical loader) + `PageLoader` (centered full-height).
- Create `src/components/skeletons.tsx` — app-wide `GridSkeleton`, `FormSkeleton`; re-export `ListSkeleton`/`TableSkeleton` from dashboard skeletons.
- Modify (sweep) 28 page/component files — see task list.
- Keep `src/components/ui/skeleton.tsx` and `src/components/dashboard/skeletons.tsx` unchanged (except possible new exports).

---

### Task 1: Spinner + PageLoader primitives

**Files:**
- Create: `src/components/ui/spinner.tsx`

- [ ] **Step 1: Create the primitive**

```tsx
import { Loader2, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/** Canonical loader. Size via className (default size-4); color inherits via currentColor. */
function Spinner({ className, ...props }: LucideProps) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

/** Centered full-height loader for route/auth gates where no layout shape is known. */
function PageLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-[60vh] w-full items-center justify-center", className)}>
      <Spinner className="size-10 text-sage" />
    </div>
  );
}

export { Spinner, PageLoader };
```

- [ ] **Step 2: Verify it compiles + lints**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | rg spinner ; npm run lint 2>&1 | rg -i 'spinner|error' | head`
Expected: no errors referencing `spinner.tsx`.

- [ ] **Step 3: Commit** (only on owner approval)

```bash
git add src/components/ui/spinner.tsx
git commit -m "feat(ui): add canonical Spinner + PageLoader"
```

---

### Task 2: Generic skeletons

**Files:**
- Create: `src/components/skeletons.tsx`

- [ ] **Step 1: Create generic skeletons**

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Re-export existing skeletons so consumers have one import path.
export {
  ListSkeleton,
  TableSkeleton,
  StatRowSkeleton,
  CardBlockSkeleton,
} from "@/components/dashboard/skeletons";

/** Responsive card grid placeholder (catalogs, book, packages, menu, products). */
export function GridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="rounded-2xl shadow-xs">
          <CardHeader>
            <Skeleton className="h-40 w-full rounded-xl" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Labelled form-field placeholders (profile, settings). */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles + lints**

Run: `npx tsc --noEmit 2>&1 | rg skeletons ; npm run lint 2>&1 | rg -i error | head`
Expected: no errors referencing `skeletons.tsx`.

- [ ] **Step 3: Commit** (on approval)

```bash
git add src/components/skeletons.tsx
git commit -m "feat(ui): add generic Grid/Form skeletons"
```

---

## Sweep tasks — conversion rules

For every sweep task below, apply the same mechanical rules. **Do not blind-replace** — read each site's surrounding markup first.

1. **Inline action loader** (inside a `<Button>`/clickable, gated by `saving`/`submitting`/`isPending`):
   - Replace the bespoke div / `Loader2` with `<Spinner className="mr-2 size-4" />` (keep the trailing label text).
   - Remove now-unused `Loader2` import if no longer referenced.
2. **Full-page loader with a known layout** (early `if (loading) return <centered spinner/>`):
   - Replace with the matching skeleton (`GridSkeleton` for card grids, `ListSkeleton` for lists, `TableSkeleton` for tables, `FormSkeleton` for forms), wrapped in the page's normal container/shell.
3. **Full-page loader, gate / unknown layout** (auth check, redirect wait):
   - Replace with `<PageLoader />`.
4. After edit: import `Spinner`/`PageLoader` from `@/components/ui/spinner`; skeletons from `@/components/skeletons`.

**Per-task verification (run for the files in that task):**
- `npm run lint 2>&1 | rg -i error | head`
- `rg -n 'animate-spin|border-t-sage|border-t-transparent' <files in this task>` → expect no matches.

---

### Task 3: Auth + shared components

**Files (Modify):**
- `src/components/auth/SignInForm.tsx:227` (inline `Loader2`)
- `src/components/auth/SignUpForm.tsx` (1 inline)
- `src/components/RoleSwitcher.tsx` (1 inline)
- `src/components/CheckoutModal.tsx` (2 inline)
- `src/components/ClassCatalog.tsx:117` (full-page grid → `GridSkeleton`)
- `src/components/Instructors.tsx:274` (full-page grid → `GridSkeleton`)

- [ ] **Step 1:** Apply conversion rules to each file. Inline loaders → `<Spinner className="mr-2 size-4" />`; `ClassCatalog`/`Instructors` full-page `h-12 w-12 border-t-sage` → `<GridSkeleton />` in the existing grid container.
- [ ] **Step 2:** Run per-task verification (lint + grep guard on the 6 files). Expected: no `animate-spin`/`border-t-*` matches, lint clean.
- [ ] **Step 3 (on approval):** `git add` the 6 files; `git commit -m "refactor(ui): canonical loaders in auth + shared components"`.

---

### Task 4: Member portal — data-load pages → skeletons

**Files (Modify):**
- `src/pages/classes.tsx:434,596` (grids → `GridSkeleton`)
- `src/pages/portal/book.tsx:858` (full-page → `GridSkeleton` in book grid)
- `src/pages/portal/bookings.tsx:157` (full-page → `ListSkeleton`)
- `src/pages/portal/packages.tsx` (3 sites: page-load grid → `GridSkeleton`; action buttons → `Spinner`)
- `src/pages/portal/menu.tsx` (2 sites: grid → `GridSkeleton`; action → `Spinner`)

- [ ] **Step 1:** Convert per rules. Distinguish page-load (skeleton) from in-button (`Spinner`) at each of the listed sites.
- [ ] **Step 2:** Per-task verification (lint + grep guard on the 5 files).
- [ ] **Step 3 (on approval):** commit `-m "refactor(ui): skeletons + spinner in member portal pages"`.

---

### Task 5: Member portal — profile, gates, misc

**Files (Modify):**
- `src/pages/portal/profile.tsx:322` (full-page → `FormSkeleton` inside profile shell), `:444,:505,:598` (save/submit buttons → `Spinner`)
- `src/pages/portal/onboarding.tsx` (1, gate → `PageLoader`)
- `src/pages/portal/payment/razorpay-return.tsx` (1, gate → `PageLoader`)
- `src/pages/portal/reset-password.tsx` (1, inline submit → `Spinner`)

- [ ] **Step 1:** Convert per rules. profile page-load → `FormSkeleton`; the three profile save buttons → `<Spinner className="mr-2 size-4" />` keeping "Saving…"/"Submitting…" text; onboarding + razorpay-return gates → `<PageLoader />`.
- [ ] **Step 2:** Per-task verification (lint + grep guard on the 4 files).
- [ ] **Step 3 (on approval):** commit `-m "refactor(ui): canonical loaders in profile + portal gates"`.

---

### Task 6: Instructor + partner portals

**Files (Modify):**
- `src/pages/instructor/dashboard.tsx:371,490,548` (check-in action buttons → `Spinner`; keep existing dashboard skeleton)
- `src/pages/partner/settings.tsx` (2: page-load → `FormSkeleton`; save → `Spinner`)
- `src/pages/partner/members.tsx` (1: page-load → `TableSkeleton`)
- `src/pages/partner/classes.tsx` (1: page-load → `ListSkeleton`)

- [ ] **Step 1:** Convert per rules.
- [ ] **Step 2:** Per-task verification (lint + grep guard on the 4 files).
- [ ] **Step 3 (on approval):** commit `-m "refactor(ui): canonical loaders in instructor + partner portals"`.

---

### Task 7: Admin — list/table pages

**Files (Modify):**
- `src/pages/admin/members.tsx:705` (page-load → `TableSkeleton`), `:1404` (action → `Spinner`)
- `src/pages/admin/credits.tsx:138` (page-load → `TableSkeleton`)
- `src/pages/admin/cafe.tsx` (5 sites: page-load grid → `GridSkeleton`; action buttons → `Spinner`)
- `src/pages/admin/CRM.tsx` (4 sites: page-load → `ListSkeleton`/`TableSkeleton`; actions → `Spinner`)
- `src/pages/admin/partners.tsx` (2: page-load → `TableSkeleton`; action → `Spinner`)

- [ ] **Step 1:** Convert per rules; pick the skeleton matching each page's real layout.
- [ ] **Step 2:** Per-task verification (lint + grep guard on the 5 files).
- [ ] **Step 3 (on approval):** commit `-m "refactor(ui): canonical loaders in admin list pages"`.

---

### Task 8: Admin — schedule, control, dashboard

**Files (Modify):**
- `src/pages/admin/schedule.tsx:812` (page-load → `ListSkeleton`/`TableSkeleton`), `:1465,1512,1566,1589` (inline/action → `Spinner`)
- `src/pages/admin/schedule/[id].tsx` (1: page-load → matching skeleton or `PageLoader`)
- `src/pages/admin/control.tsx:789,889,1037,1346` (panel-load → `CardBlockSkeleton`/`ListSkeleton`; keep `ControlAnalyticsPanel` skeleton usage)
- `src/pages/admin/dashboard.tsx:4070,4119,4142` (inline/search/action → `Spinner`; keep `AdminDashboardSkeleton`)

- [ ] **Step 1:** Convert per rules. Note `admin/dashboard` + `admin/control` already use real skeletons for the main load — only the small inline `border-t-*` action spinners change here.
- [ ] **Step 2:** Per-task verification (lint + grep guard on the 4 files).
- [ ] **Step 3 (on approval):** commit `-m "refactor(ui): canonical loaders in admin schedule/control/dashboard"`.

---

### Task 9: Final guard + smoke test

**Files:** none (verification only)

- [ ] **Step 1: Global grep guard — spinner**

Run: `rg -n 'animate-spin' src`
Expected: ONLY `src/components/ui/spinner.tsx`.

- [ ] **Step 2: Global grep guard — bespoke loader divs**

Run: `rg -n 'border-t-sage|border-t-transparent rounded-full' src`
Expected: no matches.

- [ ] **Step 3: Lint clean**

Run: `npm run lint`
Expected: no errors (warnings pre-existing OK).

- [ ] **Step 4: Stray Loader2 import check**

Run: `rg -n "Loader2" src | rg -v 'ui/spinner.tsx'`
Expected: no matches (all Loader2 usage now via `Spinner`).

- [ ] **Step 5: Playwright responsive smoke**

Run: `npx playwright test` (config already present)
Expected: existing responsive specs pass; no new layout breaks.

- [ ] **Step 6: Commit** (on approval)

```bash
git add -A
git commit -m "chore(ui): verify consistent loading sweep"
```

---

## Self-Review

- **Spec coverage:** primitives (Task 1), generic skeletons (Task 2), full sweep across all 28 files mapped in spec table (Tasks 3–8), all 4 verification/grep guards from spec (Task 9). ✓
- **Placeholders:** none — every sweep site has file:line + the rule to apply; primitive code is complete.
- **Type consistency:** `Spinner`/`PageLoader` from `@/components/ui/spinner`; `GridSkeleton`/`FormSkeleton`/`ListSkeleton`/`TableSkeleton` from `@/components/skeletons`. Consistent across all tasks.
- **Risk note carried from spec:** verify `currentColor` spinner reads white on sage primary buttons (check during Task 3 auth submit button).
