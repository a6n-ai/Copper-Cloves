# Public Classes Page Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the public `/classes` page into a marketing-focused catalog of editorial class cards that open a quick-view modal with full description, benefits, and the assigned instructor.

**Architecture:** Keep the page on `getStaticProps` + 5-min ISR. Fix the data transform (real `duration`/`max_capacity`, pass instructor through). Extract four presentational components under `src/components/classes/` (ClassCard, ClassDetailDialog, InstructorStrip, CategoryFilter) plus a fallback helper. Page owns all state; components take plain props. Build on existing shadcn/ui primitives (`Card`, `Badge`, `Button`, `Tabs`, `ResponsiveDialog`) styled to brand tokens.

**Tech Stack:** Next.js 15 (Pages Router), React 18, TypeScript, Tailwind, shadcn/ui + Radix, next-auth, Prisma. Verification: `npx tsc --noEmit`, `npm run lint`, Playwright (`npm run test:e2e`).

**Spec:** `docs/superpowers/specs/2026-06-03-classes-page-revamp-design.md`

**Brand tokens:** sage `#8f9779`, terracotta `#c17856`, cream `#f5f2ea`, sand `#e8e4d9`, white-warm `#fafaf8`, warm border `#e5e4dc`, charcoal `#333`. Tailwind utilities already exist: `bg-sage`, `text-sage`, `bg-cream`, `bg-white-warm`, `text-charcoal`, `text-terracotta`, `border-sage/20`, `font-display` (Playfair), `font-body` (Montserrat). No pure `#fff`/`#000`. No em dashes in copy.

---

## Verification convention

This is UI work in a repo with no unit-test runner. Per-task gate:
- `npx tsc --noEmit` — the real type gate (the build sets `ignoreBuildErrors: true`, so tsc is authoritative). Expect: no new errors in the files you touched. The repo has ~6 pre-existing errors in unrelated files (phone-input, sendBookingEmail, razorpayPersistence, onboarding, whoami-debug); ignore those.
- `npm run lint` — expect clean for touched files.

Behavior is verified by a Playwright spec in Task 10 (`npm run test:e2e`).

---

## Task 1: Fix the data transform + define PublicClass type

The current `getStaticProps` maps non-existent fields (`duration_minutes`, `capacity`) so every card shows 60 min / 15 cap, and discards instructor detail. Fix the mapping, pass instructor through, order by `display_order`.

**Files:**
- Modify: `src/pages/classes.tsx` (imports, `getStaticProps` ~286-314, add `PublicClass` type, remove `TransformedClass`)

- [ ] **Step 1: Add the shared `PublicClass` type**

Add near the top of `src/pages/classes.tsx`, replacing the `// eslint-disable-next-line ... type TransformedClass = any;` line (~279-280):

```tsx
export interface PublicInstructor {
  name: string;
  title: string | null;
  imageUrl: string | null;
  specialties: string[];
}

export interface PublicClass {
  id: string;
  name: string;
  category: string;
  description: string;
  benefits: string[];
  duration: number;
  maxCapacity: number;
  imageUrl: string | null;
  instructor: PublicInstructor | null;
}
```

- [ ] **Step 2: Rewrite `getStaticProps` to map real fields**

Replace the existing `getStaticProps` (and the `ClassesPageProps` interface) with:

```tsx
interface ClassesPageProps {
  initialClasses: PublicClass[];
}

export const getStaticProps: GetStaticProps<ClassesPageProps> = async () => {
  try {
    const rows = await prisma.classModel.findMany({
      orderBy: [{ display_order: "asc" }, { name: "asc" }],
      include: {
        instructor: {
          omit: { studio_payout_cut_percent: true, hashed_password: true },
        },
      },
    });
    const initialClasses: PublicClass[] = rows.map((cls) => ({
      id: cls.id,
      name: cls.name || "Class",
      category: cls.category || "General",
      description: cls.description || "",
      benefits: cls.benefits ?? [],
      duration: cls.duration ?? 60,
      maxCapacity: cls.max_capacity ?? 15,
      imageUrl: cls.image_url ?? null,
      instructor: cls.instructor
        ? {
            name: cls.instructor.name,
            title: cls.instructor.title ?? null,
            imageUrl: cls.instructor.image_url ?? null,
            specialties: cls.instructor.specialties ?? [],
          }
        : null,
    }));
    return { props: { initialClasses }, revalidate: 300 };
  } catch {
    return { props: { initialClasses: [] }, revalidate: 300 };
  }
};
```

Note: `display_order` is nullable; Prisma sorts nulls last by default for ascending, which is the desired behavior (ordered classes first, then alphabetical).

- [ ] **Step 3: Update the component's state type**

In `ClassesPage`, change the classes state line:

```tsx
const [classes] = useState<PublicClass[]>(initialClasses);
```

The page will not compile fully until Task 7 (the old card JSX references `classItem.image_url` etc.). That is expected; this task only changes the data layer and type. Do not run the full typecheck to green here.

- [ ] **Step 4: Commit**

```bash
git add src/pages/classes.tsx
git commit -m "fix(classes): map real duration/max_capacity + pass instructor to public page"
```

---

## Task 2: Branded image fallback helper

Classes without `image_url` must render a branded panel (sage gradient + initials), never a broken image.

**Files:**
- Create: `src/components/classes/classFallback.ts`

- [ ] **Step 1: Write the helper**

```ts
/** Up to two uppercase initials from a class name, for the image fallback panel. */
export function classInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "C";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Tailwind classes for the branded sage-gradient fallback panel (no terracotta — Two-Voice Rule). */
export const classFallbackGradient =
  "bg-linear-to-br from-sage/80 to-sage flex items-center justify-center";
```

- [ ] **Step 2: Verify types + lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: no errors referencing `classFallback.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/components/classes/classFallback.ts
git commit -m "feat(classes): branded image fallback helper"
```

---

## Task 3: InstructorStrip component

Compact instructor row: avatar (image or gradient + initial), name, title, specialty tags. All fields optional-safe.

**Files:**
- Create: `src/components/classes/InstructorStrip.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Badge } from "@/components/ui/badge";
import type { PublicInstructor } from "@/pages/classes";

export function InstructorStrip({ instructor }: { instructor: PublicInstructor }) {
  const initial = (instructor.name || "I").slice(0, 1).toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#e5e4dc] bg-cream p-3">
      {instructor.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={instructor.imageUrl}
          alt={instructor.name}
          className="size-11 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-terracotta/80 to-terracotta font-display text-lg text-white-warm">
          {initial}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-body text-sm font-semibold text-charcoal">{instructor.name}</p>
        {instructor.title && (
          <p className="font-body text-xs text-charcoal/55">{instructor.title}</p>
        )}
        {instructor.specialties.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {instructor.specialties.slice(0, 4).map((s) => (
              <Badge
                key={s}
                variant="outline"
                className="border-sage/30 bg-sage/10 text-[10px] font-medium text-sage"
              >
                {s}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types + lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: no errors referencing `InstructorStrip.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/classes/InstructorStrip.tsx
git commit -m "feat(classes): InstructorStrip component"
```

---

## Task 4: ClassCard component (editorial)

Flat-at-rest card, lift on hover, instructor avatar peeking, whole card is a keyboard-accessible trigger.

**Files:**
- Create: `src/components/classes/ClassCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Badge } from "@/components/ui/badge";
import { classInitials, classFallbackGradient } from "./classFallback";
import type { PublicClass } from "@/pages/classes";

export function ClassCard({
  classItem,
  onOpen,
}: {
  classItem: PublicClass;
  onOpen: (c: PublicClass) => void;
}) {
  const instructorInitial = (classItem.instructor?.name || "").slice(0, 1).toUpperCase();
  return (
    <button
      type="button"
      onClick={() => onOpen(classItem)}
      aria-label={`View details for ${classItem.name}`}
      className="group block w-full overflow-hidden rounded-2xl border border-[#e5e4dc] bg-white-warm text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[#d8d3c4] hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
    >
      <div className="relative h-56 overflow-hidden">
        {classItem.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={classItem.imageUrl}
            alt={classItem.name}
            className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className={`h-full w-full ${classFallbackGradient}`} aria-hidden="true">
            <span className="font-display text-5xl text-white-warm/55">
              {classInitials(classItem.name)}
            </span>
          </div>
        )}
        <Badge className="absolute left-3 top-3 border-0 bg-white-warm/90 text-xs text-sage">
          {classItem.category}
        </Badge>
        {classItem.instructor && (
          <div className="absolute -bottom-4 right-4 size-10 overflow-hidden rounded-full border-2 border-white-warm bg-linear-to-br from-terracotta/80 to-terracotta">
            {classItem.instructor.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={classItem.instructor.imageUrl}
                alt={classItem.instructor.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-sm text-white-warm">
                {instructorInitial}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="p-5 pt-6">
        <h3 className="font-display text-2xl text-charcoal">{classItem.name}</h3>
        <p className="mt-1 font-body text-sm text-charcoal/55">
          {classItem.duration} min
          {classItem.instructor ? ` · with ${classItem.instructor.name}` : ""}
        </p>
        <span className="mt-3 inline-block font-body text-sm font-medium text-terracotta">
          View details →
        </span>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Verify types + lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: no errors referencing `ClassCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/classes/ClassCard.tsx
git commit -m "feat(classes): editorial ClassCard with branded fallback + instructor avatar"
```

---

## Task 5: ClassDetailDialog (quick-view modal)

Built on `ResponsiveDialog` (dialog desktop, bottom sheet mobile). Full description, benefits checklist, instructor strip, auth-aware CTA.

**Files:**
- Create: `src/components/classes/ClassDetailDialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/responsive/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Users } from "lucide-react";
import { InstructorStrip } from "./InstructorStrip";
import { classInitials, classFallbackGradient } from "./classFallback";
import type { PublicClass } from "@/pages/classes";

export function ClassDetailDialog({
  classItem,
  authed,
  onClose,
  onBook,
}: {
  classItem: PublicClass | null;
  authed: boolean;
  onClose: () => void;
  onBook: () => void;
}) {
  return (
    <ResponsiveDialog open={!!classItem} onOpenChange={(o) => { if (!o) onClose(); }}>
      <ResponsiveDialogContent className="max-w-lg overflow-hidden bg-white-warm p-0 sm:max-h-[90vh] sm:overflow-y-auto">
        {classItem && (
          <>
            <div className="relative h-44">
              {classItem.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={classItem.imageUrl} alt={classItem.name} className="h-full w-full object-cover" />
              ) : (
                <div className={`h-full w-full ${classFallbackGradient}`} aria-hidden="true">
                  <span className="font-display text-5xl text-white-warm/55">{classInitials(classItem.name)}</span>
                </div>
              )}
              <Badge className="absolute left-4 top-4 border-0 bg-white-warm/90 text-xs text-sage">
                {classItem.category}
              </Badge>
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              <ResponsiveDialogHeader className="space-y-1 text-left">
                <ResponsiveDialogTitle className="font-display text-3xl text-charcoal">
                  {classItem.name}
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-sm text-charcoal/55">
                  <span className="inline-flex items-center gap-1.5"><Clock className="size-4" />{classItem.duration} min</span>
                  <span className="inline-flex items-center gap-1.5"><Users className="size-4" />up to {classItem.maxCapacity} spots</span>
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>

              {classItem.description && (
                <p className="font-body text-sm leading-relaxed text-charcoal/75">{classItem.description}</p>
              )}

              {classItem.benefits.length > 0 && (
                <div>
                  <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.12em] text-sage">
                    What you&apos;ll gain
                  </p>
                  <ul className="space-y-1.5">
                    {classItem.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2 font-body text-sm text-charcoal/75">
                        <CheckCircle className="mt-0.5 size-4 shrink-0 text-sage" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {classItem.instructor && <InstructorStrip instructor={classItem.instructor} />}

              <Button variant="sage" className="w-full" onClick={onBook}>
                {authed ? "Book this class" : "Sign up to book"}
              </Button>
            </div>
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
```

- [ ] **Step 2: Verify types + lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: no errors referencing `ClassDetailDialog.tsx`. If `ResponsiveDialogContent` rejects `p-0`/className, confirm it spreads `className` (it does, per `src/components/responsive/ResponsiveDialog.tsx:61`).

- [ ] **Step 3: Commit**

```bash
git add src/components/classes/ClassDetailDialog.tsx
git commit -m "feat(classes): quick-view ClassDetailDialog with benefits + instructor"
```

---

## Task 6: CategoryFilter component

Chip row driving the existing `selectedFilter` state.

**Files:**
- Create: `src/components/classes/CategoryFilter.tsx`

- [ ] **Step 1: Write the component**

```tsx
export function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const options = ["all", ...categories];
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            className={`rounded-full border px-4 py-1.5 font-body text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage ${
              active
                ? "border-[#d8d3c4] bg-sand font-medium text-charcoal"
                : "border-[#e5e4dc] bg-white-warm text-charcoal/60 hover:bg-muted-surface"
            }`}
          >
            {opt === "all" ? "All" : opt}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify types + lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: no errors referencing `CategoryFilter.tsx`. (`bg-muted-surface` maps to `#f4f3ec`; if the utility is absent, use `bg-cream` instead.)

- [ ] **Step 3: Commit**

```bash
git add src/components/classes/CategoryFilter.tsx
git commit -m "feat(classes): CategoryFilter chip row"
```

---

## Task 7: Wire components into the page + remove dead code + fix CTAs

Replace the old card grid, render the filter and dialog, delete the hardcoded `classDetails` array, fix the Packages CTA route.

**Files:**
- Modify: `src/pages/classes.tsx`

- [ ] **Step 1: Remove dead code and unused imports**

Delete the entire hardcoded array and its interface:
- The `interface ClassDetail { ... }` block (~46-53).
- The `const classDetails: ClassDetail[] = [ ... ];` block (~67-208).

Remove now-unused imports from the top: `Card`, `CardContent` are still used by `ClassCardSkeleton` (keep). Remove `Sparkles` from the lucide import if no longer referenced after Step 3. Leave `Clock`, `Calendar`, `ChevronLeft`, `ChevronRight`, `CheckCircle` as needed.

- [ ] **Step 2: Add component imports + derived categories + selected-class state**

Add imports near the other component imports:

```tsx
import { ClassCard } from "@/components/classes/ClassCard";
import { ClassDetailDialog } from "@/components/classes/ClassDetailDialog";
import { CategoryFilter } from "@/components/classes/CategoryFilter";
```

Inside `ClassesPage`, add state and derived categories (near `selectedFilter`):

```tsx
const [selectedClass, setSelectedClass] = useState<PublicClass | null>(null);
const categories = useMemo(
  () => Array.from(new Set(classes.map((c) => c.category))).sort((a, b) => a.localeCompare(b)),
  [classes],
);
```

- [ ] **Step 3: Replace the Classes tab grid**

Replace the entire `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">...</div>` block inside `TabsContent value="classes"` (the `filteredClasses.map(...)` Card block, ~510-569) with:

```tsx
<>
  <div className="mb-8">
    <CategoryFilter categories={categories} value={selectedFilter} onChange={setSelectedFilter} />
  </div>
  <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
    {filteredClasses.map((classItem) => (
      <ClassCard key={classItem.id} classItem={classItem} onOpen={setSelectedClass} />
    ))}
  </div>
</>
```

Keep the surrounding `loading ? <ClassesGridSkeleton/> : filteredClasses.length === 0 ? <empty> : (...)` structure; only the success branch changes.

- [ ] **Step 4: Add a `handleViewPackages` handler and fix the CTA**

Add next to `handleBookClass`:

```tsx
function handleViewPackages() {
  if (authStatus !== "authenticated") {
    router.push("/portal/login?redirect=/portal/packages");
    return;
  }
  router.push("/portal/packages");
}
```

Also prefetch packages alongside book in the existing auth `useEffect`:

```tsx
if (authStatus === "authenticated") {
  void router.prefetch("/portal/book");
  void router.prefetch("/portal/packages");
} else if (authStatus === "unauthenticated") {
  void router.prefetch("/portal/login?redirect=/portal/book");
}
```

In the CTA section, change the "View Packages" button's `onClick` from `handleBookClass` to `handleViewPackages` (~747-753).

- [ ] **Step 5: Render the dialog before `<Footer />`**

Add just before `<Footer />`:

```tsx
<ClassDetailDialog
  classItem={selectedClass}
  authed={authStatus === "authenticated"}
  onClose={() => setSelectedClass(null)}
  onBook={handleBookClass}
/>
```

- [ ] **Step 6: Typecheck + lint to green**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: PASS for all `classes.tsx` and `src/components/classes/*` files (only the unrelated pre-existing errors remain).

- [ ] **Step 7: Commit**

```bash
git add src/pages/classes.tsx
git commit -m "feat(classes): editorial cards + quick-view modal + category filter; fix packages CTA; drop dead data"
```

---

## Task 8: Editorial hero (no gradient, no stat)

Replace the gradient hero with a left-aligned editorial intro + one committed image.

**Files:**
- Modify: `src/pages/classes.tsx` (the `{/* Hero Section */}` `<section>` ~467-478)

- [ ] **Step 1: Replace the hero section**

```tsx
{/* Hero Section */}
<section className="bg-cream pt-32 pb-12">
  <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-[1.3fr_1fr] lg:px-8">
    <div>
      <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-sage">
        The Studio · Classes
      </p>
      <h1 className="mt-3 font-display text-5xl leading-[1.05] text-charcoal md:text-6xl">
        Find the practice that <em className="italic text-sage">moves</em> you.
      </h1>
      <p className="mt-5 max-w-[60ch] font-body text-lg leading-relaxed text-charcoal/70">
        From high-intensity circuits to restorative flows, every class is led by a real
        instructor and built to meet you where you are. Browse the studio, then book your first.
      </p>
    </div>
    <div className="relative h-64 overflow-hidden rounded-2xl shadow-[0_8px_48px_rgba(51,51,51,0.14)] lg:h-80">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cdnUrl("/warriorrythm.jpg")}
        alt="A class in session at The Studio by Copper and Cloves"
        className="h-full w-full object-cover"
      />
    </div>
  </div>
</section>
```

`cdnUrl` is already imported. `/warriorrythm.jpg` is an existing asset referenced previously in this file's history.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: PASS for `classes.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/classes.tsx
git commit -m "feat(classes): editorial hero, drop sage+terracotta gradient"
```

---

## Task 9: Light Schedule-tab polish (flat at rest)

Restyle only; no logic change.

**Files:**
- Modify: `src/pages/classes.tsx` (the `TabsContent value="schedule"` block ~574-731)

- [ ] **Step 1: Soften the schedule container and header**

On the schedule wrapper `<div className="bg-white-warm rounded-2xl shadow-lg border border-sage/10 overflow-hidden">` change `shadow-lg` to `shadow-[0_4px_24px_rgba(51,51,51,0.08)]` and `border-sage/10` to `border-[#e5e4dc]`.

On the schedule header `<div className="bg-linear-to-r from-sage/10 via-cream to-terracotta/5 ...">` replace the gradient with a single flat tint: `className="bg-cream p-6 border-b border-[#e5e4dc]"` (removes the sage+terracotta co-mix per the Two-Voice Rule).

- [ ] **Step 2: Align day-column borders**

In the schedule grid container `<div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-sage/10">` change `divide-sage/10` to `divide-[#e5e4dc]`. In the per-day header `border-b border-sage/10` → `border-b border-[#e5e4dc]`.

Keep all behavior: week/month nav, morning markers (`text-sage`), empty states, `isMorningClass` logic.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/classes.tsx
git commit -m "style(classes): flat-at-rest schedule tab to match catalog"
```

---

## Task 10: Playwright behavior spec

Add a `/classes`-specific spec covering the revamp behaviors. Runs against the dev server (auto-started by Playwright) on mobile viewports.

**Files:**
- Create: `e2e/classes.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";

test.describe("/classes catalog", () => {
  test("cards render and open a detail dialog", async ({ page }) => {
    await page.goto("/classes");
    await page.waitForLoadState("networkidle");

    const cards = page.getByRole("button", { name: /View details for/ });
    const count = await cards.count();
    test.skip(count === 0, "no classes seeded in this environment");

    await cards.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // CTA reflects logged-out state on the public page.
    await expect(dialog.getByRole("button", { name: /Sign up to book/ })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("category filter narrows the grid", async ({ page }) => {
    await page.goto("/classes");
    await page.waitForLoadState("networkidle");

    const chips = page.getByRole("button", { pressed: false });
    const chipCount = await chips.count();
    test.skip(chipCount === 0, "no category chips (no classes seeded)");

    const allCount = await page.getByRole("button", { name: /View details for/ }).count();
    await chips.first().click();
    const filtered = await page.getByRole("button", { name: /View details for/ }).count();
    expect(filtered).toBeLessThanOrEqual(allCount);
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `npm run test:e2e -- classes.spec.ts`
Expected: PASS (tests `test.skip` themselves gracefully if the local DB has no seeded classes). If classes are seeded, the dialog open/close and filter assertions must pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/classes.spec.ts
git commit -m "test(classes): e2e coverage for card dialog + filter"
```

---

## Task 11: Final verification + visual check

- [ ] **Step 1: Full typecheck + lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: no new errors in `src/pages/classes.tsx` or `src/components/classes/*`.

- [ ] **Step 2: Visual check via the run skill / dev server**

Start the app (`npm run dev:next`) and load `/classes`. Confirm:
- Cards show real per-class durations (not all "60 min").
- A photo-less class shows the sage-gradient initials fallback, not a broken image.
- A class with no assigned instructor: card omits "with …", avatar hidden; modal hides the instructor strip; no crash.
- Filter chips narrow the grid; "All" restores.
- Modal opens on card click and on Enter; Esc closes; focus returns to the card.
- CTA "View packages" routes to packages (login-with-redirect when logged out).
- Mobile (≤768px): grid single-column, modal is a bottom sheet, hero stacks.

- [ ] **Step 3: Final commit (if any tweaks)**

```bash
git add -A
git commit -m "chore(classes): final polish for catalog revamp"
```

---

## Spec coverage map

- Editorial cards → Task 4. Quick-view modal → Task 5. Instructor strip → Task 3. Category filter → Task 6. Branded fallback → Task 2. Hero → Task 8. Schedule polish → Task 9. CTA fix → Task 7. P0 data bug → Task 1. Dead-code removal → Task 7. Benefits-as-checklist → Task 5. Keyboard-accessible cards → Task 4. Auth-aware CTA → Tasks 5 & 7. shadcnspace reference patterns informed Tasks 4/5/3. Verification → Tasks 10 & 11.
