# Classes-not-Credits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `credits_remaining` the single source of truth for a member's class count, drop the drifting `classes_remaining` column, route all pass-category logic through one helper, and relabel "credits" → "classes" in the UI.

**Architecture:** `UserPackage.credits_remaining` (live, decremented) is authoritative; `credits_total` is the original count; `null` credits = studio (unlimited) pass. The redundant `classes_remaining` column is removed after a prod backfill. All UIs derive pass category from `passCategoryForPackageType()` instead of stale `pass_type` snapshots.

**Tech Stack:** Next.js 15 (Pages Router), Prisma 7, TypeScript, vitest (new, for pure-logic unit tests).

**Spec:** `docs/superpowers/specs/2026-05-30-classes-not-credits-design.md`

**Prod-safety note:** `db:push` and the backfill target the **prod RDS** (per `.env.local`). The executor must NOT run `db:push` or the backfill against prod. Those are run by the user, in this order: **(1) backfill → verify → (2) `db:push`**. See Task 9.

---

### Task 1: Add vitest + characterization tests for the category helper

`passCategoryForPackageType()` already exists and is correct. These tests lock its behavior before we expand its use across the admin UIs (safety net, not new behavior).

**Files:**
- Modify: `package.json` (add devDeps + `test:unit` script)
- Create: `vitest.config.ts`
- Create: `src/lib/__tests__/couponHelpers.test.ts`

- [ ] **Step 1: Install vitest**

Run: `npm i -D vitest@^2`
Expected: vitest + deps added to `devDependencies`.

- [ ] **Step 2: Add the test script**

In `package.json` `scripts`, add after the `test:e2e:ui` line:

```json
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write the characterization test**

Create `src/lib/__tests__/couponHelpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { passCategoryForPackageType } from "@/lib/couponHelpers";

describe("passCategoryForPackageType", () => {
  it("returns studio_pass for explicit studio type", () => {
    expect(passCategoryForPackageType({ type: "studio_pass" })).toBe("studio_pass");
    expect(passCategoryForPackageType({ type: "studio" })).toBe("studio_pass");
  });

  it("returns class_pass for explicit class type", () => {
    expect(passCategoryForPackageType({ type: "class_pass" })).toBe("class_pass");
    expect(passCategoryForPackageType({ type: "class" })).toBe("class_pass");
  });

  it("falls back to is_unlimited for legacy 'standard' rows", () => {
    expect(passCategoryForPackageType({ type: "standard", is_unlimited: true })).toBe("studio_pass");
    expect(passCategoryForPackageType({ type: "standard", is_unlimited: false })).toBe("class_pass");
  });

  it("defaults empty/null type to class_pass unless unlimited", () => {
    expect(passCategoryForPackageType({})).toBe("class_pass");
    expect(passCategoryForPackageType({ type: null, is_unlimited: null })).toBe("class_pass");
    expect(passCategoryForPackageType({ is_unlimited: true })).toBe("studio_pass");
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npm run test:unit`
Expected: PASS (4 tests). These guard existing behavior.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/__tests__/couponHelpers.test.ts
git commit -m "test: add vitest + characterization tests for passCategoryForPackageType"
```

---

### Task 2: TDD a pure `shouldBackfillCredits` decision function

The backfill must fill `credits_remaining` only for **class passes** that have a null count but a non-null legacy `classes_remaining`. Studio passes stay null. Extract this rule as a pure, tested function.

**Files:**
- Create: `src/lib/creditsBackfill.ts`
- Create: `src/lib/__tests__/creditsBackfill.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/creditsBackfill.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { shouldBackfillCredits } from "@/lib/creditsBackfill";

describe("shouldBackfillCredits", () => {
  it("fills a class pass with null credits from classes_remaining", () => {
    const r = shouldBackfillCredits({
      credits_remaining: null,
      credits_total: null,
      classes_remaining: 8,
      package_type: { type: "class_pass", is_unlimited: false },
    });
    expect(r).toEqual({ credits_remaining: 8, credits_total: 8 });
  });

  it("preserves an existing credits_total when filling", () => {
    const r = shouldBackfillCredits({
      credits_remaining: null,
      credits_total: 10,
      classes_remaining: 4,
      package_type: { type: "class_pass", is_unlimited: false },
    });
    expect(r).toEqual({ credits_remaining: 4, credits_total: 10 });
  });

  it("leaves studio (unlimited) passes untouched", () => {
    expect(
      shouldBackfillCredits({
        credits_remaining: null,
        credits_total: null,
        classes_remaining: 99,
        package_type: { type: "studio_pass", is_unlimited: true },
      })
    ).toBeNull();
  });

  it("does nothing when credits_remaining is already set", () => {
    expect(
      shouldBackfillCredits({
        credits_remaining: 3,
        credits_total: 5,
        classes_remaining: 5,
        package_type: { type: "class_pass", is_unlimited: false },
      })
    ).toBeNull();
  });

  it("does nothing when there is no legacy classes_remaining to copy", () => {
    expect(
      shouldBackfillCredits({
        credits_remaining: null,
        credits_total: null,
        classes_remaining: null,
        package_type: { type: "class_pass", is_unlimited: false },
      })
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:unit src/lib/__tests__/creditsBackfill.test.ts`
Expected: FAIL — "Failed to resolve import" / `shouldBackfillCredits is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/creditsBackfill.ts`:

```ts
import { passCategoryForPackageType } from "@/lib/couponHelpers";

export type BackfillablePackage = {
  credits_remaining: number | null;
  credits_total: number | null;
  classes_remaining: number | null;
  package_type: { type?: string | null; is_unlimited?: boolean | null };
};

/**
 * Decides how to backfill the authoritative count for one UserPackage.
 * Returns the new values, or null when no change is needed.
 * Only class passes with a null `credits_remaining` and a non-null legacy
 * `classes_remaining` are filled; studio (unlimited) passes stay null.
 */
export function shouldBackfillCredits(
  pkg: BackfillablePackage
): { credits_remaining: number; credits_total: number } | null {
  if (pkg.credits_remaining != null) return null;
  if (pkg.classes_remaining == null) return null;
  if (passCategoryForPackageType(pkg.package_type) !== "class_pass") return null;
  return {
    credits_remaining: pkg.classes_remaining,
    credits_total: pkg.credits_total ?? pkg.classes_remaining,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:unit src/lib/__tests__/creditsBackfill.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/creditsBackfill.ts src/lib/__tests__/creditsBackfill.test.ts
git commit -m "feat: add shouldBackfillCredits decision rule"
```

---

### Task 3: Write the prod backfill script (raw SQL, migration-safe)

Uses a single raw `UPDATE` so it does NOT depend on the generated client still having `classes_remaining` (the column is dropped in Task 8). Columns are unmapped snake_case; tables are `user_packages` / `package_types`.

**Files:**
- Create: `scripts/backfill-classes-remaining.ts`

- [ ] **Step 1: Write the script**

Create `scripts/backfill-classes-remaining.ts`:

```ts
import prisma from "@/lib/prisma";

/**
 * One-shot, idempotent. Fills the authoritative `credits_remaining` for
 * class passes that only have a legacy `classes_remaining` value. Studio
 * (unlimited) passes are skipped. Run BEFORE dropping `classes_remaining`.
 */
async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const candidates = await prisma.$queryRaw<
    { id: string; classes_remaining: number | null }[]
  >`
    SELECT up.id, up.classes_remaining
    FROM user_packages up
    JOIN package_types pt ON pt.id = up.package_type_id
    WHERE up.credits_remaining IS NULL
      AND up.classes_remaining IS NOT NULL
      AND NOT (pt.is_unlimited OR lower(coalesce(pt.type, '')) IN ('studio_pass', 'studio'))
  `;

  console.log(`Found ${candidates.length} class-pass rows to backfill.`);
  for (const c of candidates) {
    console.log(`  ${c.id} -> credits_remaining=${c.classes_remaining}`);
  }

  if (dryRun) {
    console.log("Dry run — no writes performed.");
    return;
  }

  const result = await prisma.$executeRaw`
    UPDATE user_packages up
    SET credits_remaining = up.classes_remaining,
        credits_total = COALESCE(up.credits_total, up.classes_remaining)
    FROM package_types pt
    WHERE up.package_type_id = pt.id
      AND up.credits_remaining IS NULL
      AND up.classes_remaining IS NOT NULL
      AND NOT (pt.is_unlimited OR lower(coalesce(pt.type, '')) IN ('studio_pass', 'studio'))
  `;
  console.log(`Updated ${result} rows.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Verify it compiles / dry-run locally**

Run: `npx tsx scripts/backfill-classes-remaining.ts --dry-run`
Expected: connects to whatever `DATABASE_URL` points at, prints a count and per-row preview, then "Dry run — no writes performed." (Do NOT run the non-dry version against prod — that is the user's step in Task 9.)

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-classes-remaining.ts
git commit -m "feat: add idempotent classes_remaining -> credits_remaining backfill script"
```

---

### Task 4: Route all admin pass-category logic through the helper

Replace three hand-rolled category computations + one in the dashboard data layer with `passCategoryForPackageType()`.

**Files:**
- Modify: `src/pages/admin/members.tsx:427-437`
- Modify: `src/pages/admin/control.tsx:673-691`
- Modify: `src/pages/admin/dashboard.tsx:1128-1132`
- Modify: `src/lib/adminDashboardSections.ts:540-544`

- [ ] **Step 1: `members.tsx` — import + replace**

Add to the imports at the top of `src/pages/admin/members.tsx` (alongside other `@/lib` imports):

```ts
import { passCategoryForPackageType } from "@/lib/couponHelpers";
```

Replace the block at `:427-437`:

```ts
        let passCategory: Member["passCategory"] = "none";
        if (pkg) {
          const pass = (pkg.pass_type || p.pass_type || "").toLowerCase();
          const pt = pkg.package_type;
          const t = (pt?.type || "").toLowerCase();
          if (pass === "studio_pass" || pt?.is_unlimited || t.includes("studio")) {
            passCategory = "studio_pass";
          } else {
            passCategory = "class_pass";
          }
        }
```

with:

```ts
        let passCategory: Member["passCategory"] = "none";
        if (pkg) {
          passCategory = passCategoryForPackageType(pkg.package_type);
        }
```

- [ ] **Step 2: `control.tsx` — import + replace**

Add to the imports of `src/pages/admin/control.tsx`:

```ts
import { passCategoryForPackageType } from "@/lib/couponHelpers";
```

Replace the block at `:673-691`:

```ts
          const passRaw = (
            mostRecentPackage?.pass_type ||
            profile.pass_type ||
            ""
          ).toLowerCase();
          const pt = mostRecentPackage?.package_type;
          const ptType = (pt?.type ?? "").toLowerCase();
          const isUnlimited = Boolean(pt?.is_unlimited);

          let passType: "none" | "class_pass" | "studio_pass" = "none";
          if (mostRecentPackage) {
            if (
              passRaw === "studio_pass" ||
              isUnlimited ||
              ptType.includes("studio")
            ) {
              passType = "studio_pass";
            } else {
              passType = "class_pass";
            }
          }
```

with:

```ts
          const pt = mostRecentPackage?.package_type;
          const passType: "none" | "class_pass" | "studio_pass" = mostRecentPackage
            ? passCategoryForPackageType(pt ?? {})
            : "none";
          const isUnlimited = passType === "studio_pass";
```

- [ ] **Step 3: `dashboard.tsx` — import + replace**

Add to the imports of `src/pages/admin/dashboard.tsx`:

```ts
import { passCategoryForPackageType } from "@/lib/couponHelpers";
```

Replace the block at `:1128-1132`:

```ts
        const isUnlimited = !!(
          pt?.is_unlimited ||
          activePkg?.pass_type === "studio_pass" ||
          pt?.type === "studio_pass"
        );
```

with:

```ts
        const isUnlimited = activePkg ? passCategoryForPackageType(pt ?? {}) === "studio_pass" : false;
```

- [ ] **Step 4: `adminDashboardSections.ts` — import + replace**

Add to the imports of `src/lib/adminDashboardSections.ts`:

```ts
import { passCategoryForPackageType } from "@/lib/couponHelpers";
```

Replace the block at `:540-544`:

```ts
    const isUnlimited = !!(
      up.package_type.is_unlimited ||
      up.pass_type === "studio_pass" ||
      up.package_type.type === "studio_pass"
    );
```

with:

```ts
    const isUnlimited = passCategoryForPackageType(up.package_type) === "studio_pass";
```

- [ ] **Step 5: Verify unit tests still pass + lint the touched files**

Run: `npm run test:unit && npx eslint src/pages/admin/members.tsx src/pages/admin/control.tsx src/pages/admin/dashboard.tsx src/lib/adminDashboardSections.ts`
Expected: tests PASS; eslint reports no new errors (pre-existing warnings OK).

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/members.tsx src/pages/admin/control.tsx src/pages/admin/dashboard.tsx src/lib/adminDashboardSections.ts
git commit -m "refactor(admin): derive pass category from passCategoryForPackageType everywhere"
```

---

### Task 5: Stop writing `classes_remaining`

Remove the column from all create payloads. After this, new rows rely solely on `credits_remaining` / `credits_total`.

**Files:**
- Modify: `src/pages/api/user-packages.ts:123`
- Modify: `src/pages/api/admin/users.ts:136`
- Modify: `src/lib/razorpayServerCheckout.ts:325`
- Modify: `scripts/seed-member-users.ts:258`

- [ ] **Step 1: Delete the four write lines**

In `src/pages/api/user-packages.ts`, remove the line:

```ts
            classes_remaining: packageType.class_count ?? null,
```

In `src/pages/api/admin/users.ts`, remove the line:

```ts
          classes_remaining: pass_type === "class_pass" ? creditsForClass : null,
```

In `src/lib/razorpayServerCheckout.ts`, remove the line:

```ts
        classes_remaining: packageType.class_count ?? null,
```

In `scripts/seed-member-users.ts`, remove the line:

```ts
    classes_remaining: isUnlimited ? null : credits,
```

- [ ] **Step 2: Verify the field no longer appears in writes**

Run: `rg -n "classes_remaining" src/pages/api/user-packages.ts src/pages/api/admin/users.ts src/lib/razorpayServerCheckout.ts scripts/seed-member-users.ts`
Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/user-packages.ts src/pages/api/admin/users.ts src/lib/razorpayServerCheckout.ts scripts/seed-member-users.ts
git commit -m "refactor: stop writing redundant classes_remaining column"
```

---

### Task 6: Stop reading `classes_remaining`

Remove every read/fallback. Studio passes render "Unlimited"; class passes use `credits_remaining`.

**Files:**
- Modify: `src/lib/adminDashboardSections.ts:509,553`
- Modify: `src/pages/admin/control.tsx:647,704`
- Modify: `src/pages/admin/dashboard.tsx:1133`
- Modify: `src/pages/api/admin/credit-transactions.ts:60-63`

- [ ] **Step 1: `adminDashboardSections.ts`**

Remove `classes_remaining: true,` from the `select` (line ~509).
Replace (line ~553):

```ts
      credits: up.credits_remaining ?? up.classes_remaining ?? 0,
```

with:

```ts
      credits: up.credits_remaining ?? 0,
```

- [ ] **Step 2: `control.tsx`**

Remove the type field (line ~647):

```ts
            classes_remaining?: number | null;
```

Replace (line ~704):

```ts
          const creditsVal = mostRecentPackage?.credits_remaining ?? mostRecentPackage?.classes_remaining ?? 0;
```

with:

```ts
          const creditsVal = mostRecentPackage?.credits_remaining ?? 0;
```

- [ ] **Step 3: `dashboard.tsx`**

Replace (line ~1133):

```ts
        const creditsLeft = Number(activePkg?.credits_remaining ?? activePkg?.classes_remaining ?? 0);
```

with:

```ts
        const creditsLeft = Number(activePkg?.credits_remaining ?? 0);
```

- [ ] **Step 4: `credit-transactions.ts`**

Replace the `addedRows` amount block (lines ~59-63):

```ts
    const amount =
      up.credits_total ??
      up.package_type.class_count ??
      up.classes_remaining ??
      0;
```

with:

```ts
    const amount =
      up.credits_total ??
      up.package_type.class_count ??
      0;
```

- [ ] **Step 5: Verify no production reads remain**

Run: `rg -n "classes_remaining" --glob '!prisma/**' --glob '!docs/**' src`
Expected: no matches in `src/`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/adminDashboardSections.ts src/pages/admin/control.tsx src/pages/admin/dashboard.tsx src/pages/api/admin/credit-transactions.ts
git commit -m "refactor: read credits_remaining as the single source of truth"
```

---

### Task 7: Relabel "credits" → "classes" in user-visible text

Display text only. Do NOT rename identifiers, state vars, API field names (`remaining_credits`, `credits_delta`), the `CreditCard` icon, or "Cafe Credits" (a separate concept).

**Files:**
- Modify: `src/pages/admin/credits.tsx`
- Modify: `src/pages/admin/members.tsx`
- Modify: `src/pages/admin/control.tsx`
- Modify: `src/pages/portal/packages.tsx`
- Modify: `src/pages/portal/bookings.tsx`

- [ ] **Step 1: `admin/credits.tsx` visible strings**

| Line | From | To |
|---|---|---|
| 263 | `title="Credit Tracking - Admin"` | `title="Class Tracking - Admin"` |
| 264 | `description="Monitor and manage member credits"` | `description="Monitor and manage member classes"` |
| 272 | `title="Credit Tracking"` | `title="Class Tracking"` |
| 273 | `subtitle="Monitor all credit transactions and package purchases"` | `subtitle="Monitor all class transactions and package purchases"` |
| 296 | `label="Credits Added"` | `label="Classes Added"` |
| 297 | `label="Credits Used"` | `label="Classes Used"` |
| 298 | `label="Credits Deducted"` | `label="Classes Deducted"` |
| 299 | `label="Credits Expired"` | `label="Classes Expired"` |
| 311 | `Complete audit trail of all credit movements` | `Complete audit trail of all class movements` |

Also the `reason` string in `src/pages/api/admin/credit-transactions.ts` (`"Pass expired — credits cleared"`) → `"Pass expired — classes cleared"`.

- [ ] **Step 2: `admin/members.tsx` visible strings**

| Line | From | To |
|---|---|---|
| 823 | `description="Manage members, credits, and subscriptions"` | `description="Manage members, classes, and subscriptions"` |
| 832 | `subtitle="Manage credits, subscriptions, and member data"` | `subtitle="Manage classes, subscriptions, and member data"` |
| 878 | `Click Manage to update credits and subscription` | `Click Manage to update classes and subscription` |

- [ ] **Step 3: `admin/control.tsx` visible string**

| Line | From | To |
|---|---|---|
| 2513 | `Update member information, package, or credits` | `Update member information, package, or classes` |

- [ ] **Step 4: `portal/packages.tsx` visible strings**

| Line | From | To |
|---|---|---|
| 454 | `<span class="detail-label">Credits Used:</span>` | `<span class="detail-label">Classes Used:</span>` |
| 458 | `<span class="detail-label">Credits Remaining:</span>` | `<span class="detail-label">Classes Remaining:</span>` |
| 867 | `<p ...>Credits</p>` | `<p ...>Classes</p>` |

(Leave `import { ... CreditCard ... }`, `remaining_credits`, and "Cafe Credits" untouched.)

- [ ] **Step 5: `portal/bookings.tsx` refund copy**

| Line | From | To |
|---|---|---|
| 415 | `Your class credit will be refunded to your account.` | `Your class will be refunded to your account.` |
| 420 | `your class credit will NOT be reimbursed` | `your class will NOT be reimbursed` |

- [ ] **Step 6: Verify no stray visible "credit" wording remains in these files**

Run: `rg -n "[Cc]redits? (Used|Remaining|Added|Deducted|Expired|Tracking|movements|and subscription)|credit will" src/pages/admin/credits.tsx src/pages/admin/members.tsx src/pages/admin/control.tsx src/pages/portal/packages.tsx src/pages/portal/bookings.tsx src/pages/api/admin/credit-transactions.ts`
Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/credits.tsx src/pages/admin/members.tsx src/pages/admin/control.tsx src/pages/portal/packages.tsx src/pages/portal/bookings.tsx src/pages/api/admin/credit-transactions.ts
git commit -m "refactor(ui): relabel member-visible 'credits' wording to 'classes'"
```

---

### Task 8: Drop the `classes_remaining` column from the schema

Do this **after** Tasks 5 & 6 (no code reads/writes it) and after the backfill script exists. The `db:push` itself is the user's step (Task 9) — here we only edit the schema and regenerate the client locally.

**Files:**
- Modify: `prisma/schema.prisma:341`

- [ ] **Step 1: Remove the field**

Delete line 341 of `prisma/schema.prisma`:

```prisma
  classes_remaining Int?
```

- [ ] **Step 2: Regenerate the Prisma client locally**

Run: `npm run db:generate`
Expected: "Generated Prisma Client" with no errors. (This updates `src/generated/prisma/` types so `classes_remaining` no longer exists on `UserPackage`.)

- [ ] **Step 3: Verify the build typechecks against the new client**

Run: `npm run test:unit`
Expected: PASS — unit tests don't touch the dropped field; confirms the new client imports cleanly.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: drop redundant classes_remaining column from schema"
```

---

### Task 9: Final verification + prod migration handoff

**Files:** none (verification + user-run prod steps)

- [ ] **Step 1: Full unit suite**

Run: `npm run test:unit`
Expected: all PASS (9 tests).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: `prisma generate` + `next build` complete without errors. (Note: `next.config.mjs` ignores TS errors during build, so also rely on Step 1 + manual review for type safety.)

- [ ] **Step 3: Hand off the two prod-only steps to the user**

Tell the user to run, against prod, IN THIS ORDER (the executor must not run these):

1. Backfill (verify first):
   ```bash
   npx tsx scripts/backfill-classes-remaining.ts --dry-run   # review the printed rows
   npx tsx scripts/backfill-classes-remaining.ts             # apply
   ```
2. Only after the backfill output looks right, drop the column on prod:
   ```bash
   npm run db:push
   ```

- [ ] **Step 4: Manual cross-screen e2e (after prod migration)**

For one **class-pass** member and one **studio-pass** member, open each of: portal dashboard, admin dashboard, admin members, admin control. Confirm:
- Class pass shows the **same** "N classes left" on every screen (matches the live `credits_remaining`).
- Studio pass shows **"Unlimited"** on every screen and never a stale number.
- Category label (class vs studio) is identical across all four screens.

---

## Self-Review notes

- **Spec coverage:** Part A (drop column) → Tasks 3, 5, 6, 8, 9; Part B (one helper) → Task 4; Part C (relabel) → Task 7; testing decision (vitest) → Tasks 1, 2.
- **Backfill ordering:** script (Task 3) runs against prod before `db:push` (Task 9) — sequencing is explicit and the column still exists at backfill time.
- **Identifier safety:** Task 7 explicitly excludes `remaining_credits`, `credits_delta`, `CreditCard`, "Cafe Credits", and all state vars.
- **Line numbers** are pre-edit references; later tasks key off content, not line numbers, where files have already shifted.
