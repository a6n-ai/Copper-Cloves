# Mobile-Friendly Site Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every page of the Copper & Cloves site usable on phones (320–430px) and tablets (768px) — no horizontal overflow, tappable targets, usable dialogs/tables/calendars — with targeted shadcn-space polish.

**Architecture:** Primitive-first. Build shared mobile primitives (`Container`, `ResponsiveDialog`, `ResponsiveTable`, `MobileBottomNav`) once, then sweep pages to adopt them and fix non-responsive grids/widths. A Playwright harness with per-viewport overflow assertions is built first so every page change has a verification gate.

**Tech Stack:** Next.js 15 (Pages Router), React 18, Tailwind v4 (CSS `@theme` in `globals.css`), shadcn/ui + shadcn-space MCP, `useIsMobile` hook (`src/hooks/use-mobile.tsx`), Playwright (new).

> **Commit policy:** This repo's owner does **not** auto-commit. Each task ends with a commit step, but the implementer must get explicit approval before committing/pushing, or batch commits for the owner to run. Do not push without being asked.

> **TDD note:** For this UI-responsiveness work the "failing test" is a Playwright assertion (no horizontal overflow / nav reachable) at phone+tablet viewports. Write the spec for a page, watch it fail, fix the page, watch it pass.

---

## File Structure

**New files:**
- `src/components/responsive/Container.tsx` — consistent page padding + max width
- `src/components/responsive/ResponsiveDialog.tsx` — Dialog on desktop, bottom Sheet on phone
- `src/components/responsive/ResponsiveTable.tsx` — scroll-wrap (default) + optional card-stack
- `src/components/responsive/MobileBottomNav.tsx` — member-portal bottom tab bar (phones)
- `playwright.config.ts` — viewport projects (320/375/414/768)
- `e2e/helpers/viewport.ts` — shared `expectNoHorizontalScroll` + viewport list
- `e2e/helpers/auth.ts` — programmatic login → storageState per role
- `e2e/global-setup.ts` — seed test users + write storageState
- `e2e/public.spec.ts`, `e2e/member.spec.ts`, `e2e/admin.spec.ts`, `e2e/partner.spec.ts`, `e2e/instructor.spec.ts`
- `scripts/seed-e2e-users.ts` — idempotent test member + admin
- `docs/mobile-audit.md` — living checklist of per-page offenders (from spec audit)

**Modified files (sweep):** see Phase 4–7. Each page: replace non-responsive `grid-cols-*`, relax fixed px widths, adopt primitives.

**Do NOT edit:** `src/components/ui/*` (shadcn-generated), `src/generated/prisma/*`.

---

## Phase 0 — Playwright harness + auth fixture

### Task 0.1: Install Playwright

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm i -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Add scripts to `package.json`**

Add under `"scripts"`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 3: Commit** (`chore: add playwright`)

---

### Task 0.2: Viewport helper

**Files:**
- Create: `e2e/helpers/viewport.ts`

- [ ] **Step 1: Write the helper**

```ts
import { expect, type Page } from "@playwright/test";

export const PHONE_VIEWPORTS = [
  { name: "iphone-se", width: 320, height: 568 },
  { name: "iphone-12", width: 390, height: 844 },
  { name: "iphone-plus", width: 414, height: 896 },
];
export const TABLET_VIEWPORT = { name: "ipad", width: 768, height: 1024 };
export const ALL_VIEWPORTS = [...PHONE_VIEWPORTS, TABLET_VIEWPORT];

/** Fails if the document scrolls horizontally (1px tolerance for rounding). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(1);
}
```

- [ ] **Step 2: Commit** (`test: add viewport overflow helper`)

---

### Task 0.3: Playwright config

**Files:**
- Create: `playwright.config.ts`

- [ ] **Step 1: Write config**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev:next",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "phone-320", use: { viewport: { width: 320, height: 568 } } },
    { name: "phone-390", use: { ...devices["iPhone 12"] } },
    { name: "tablet-768", use: { viewport: { width: 768, height: 1024 } } },
  ],
});
```

- [ ] **Step 2: Commit** (`test: add playwright config`)

---

### Task 0.4: Seed E2E users

**Files:**
- Create: `scripts/seed-e2e-users.ts`
- Reference: `src/lib/prisma.ts`, `prisma/schema.prisma` (Profile `@@unique([email, role])`, `findFirst` by email+role), existing seeds in `scripts/`

- [ ] **Step 1: Write idempotent seed**

```ts
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

const PASSWORD = "E2ePassw0rd!";

async function ensureProfile(email: string, role: string, name: string) {
  const existing = await prisma.profile.findFirst({ where: { email, role } });
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);
  if (existing) {
    await prisma.profile.update({ where: { id: existing.id }, data: { hashedPassword } });
    return existing.id;
  }
  const created = await prisma.profile.create({ data: { email, role, name, hashedPassword } });
  return created.id;
}

async function main() {
  await ensureProfile("e2e-member@example.com", "user", "E2E Member");
  await ensureProfile("e2e-admin@example.com", "admin", "E2E Admin");
  console.log("E2E users seeded");
}

main().finally(() => prisma.$disconnect());
```

> Run with `npx tsx scripts/seed-e2e-users.ts`. If `Profile` requires more non-null fields, read `prisma/schema.prisma` and add them to the `create` data. Partner/instructor users need extra linkage (`PartnerMember`, `Instructor.profile_id`) — add only when Phase 7 needs them; the overflow tests for those portals can use the admin/member session shape if their pages don't hard-gate differently.

- [ ] **Step 2: Run it** — `npx tsx scripts/seed-e2e-users.ts` → Expected: `E2E users seeded`
- [ ] **Step 3: Commit** (`test: seed e2e users`)

---

### Task 0.5: Auth storageState

**Files:**
- Create: `e2e/helpers/auth.ts`, `e2e/global-setup.ts`
- Reference: NextAuth credentials flow — `signIn("credentials", { email, password, role })`; login UI at `/login`.

- [ ] **Step 1: Write login + state writer**

```ts
// e2e/helpers/auth.ts
import { chromium, type FullConfig } from "@playwright/test";
import path from "path";

const PASSWORD = "E2ePassw0rd!";
export const STATE = {
  member: path.join(__dirname, "../.auth/member.json"),
  admin: path.join(__dirname, "../.auth/admin.json"),
};

export async function loginAndSave(
  baseURL: string,
  email: string,
  role: string,
  statePath: string,
) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole("button", { name: /continue|next/i }).click();
  // role picker only appears for multi-role emails; e2e users are single-role
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/(portal|admin)\//);
  await page.context().storageState({ path: statePath });
  await browser.close();
}
```

> The exact selectors depend on `src/pages/login.tsx`. Read it first and adjust `getByLabel`/`getByRole` to the real labels/button text. This is the only brittle spot — verify by running once headed (`--ui`).

```ts
// e2e/global-setup.ts
import { execSync } from "child_process";
import type { FullConfig } from "@playwright/test";
import { loginAndSave, STATE } from "./helpers/auth";

export default async function globalSetup(config: FullConfig) {
  execSync("npx tsx scripts/seed-e2e-users.ts", { stdio: "inherit" });
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  await loginAndSave(baseURL, "e2e-member@example.com", "user", STATE.member);
  await loginAndSave(baseURL, "e2e-admin@example.com", "admin", STATE.admin);
}
```

- [ ] **Step 2: Add `.auth/` to `.gitignore`**

```
e2e/.auth/
```

- [ ] **Step 3: Commit** (`test: add auth storageState setup`)

---

### Task 0.6: Public smoke spec (proves the harness)

**Files:**
- Create: `e2e/public.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers/viewport";

const PUBLIC_PAGES = [
  "/", "/classes", "/cafe", "/shop", "/rental", "/founder",
  "/policy", "/terms", "/meal-subscription", "/login", "/signup",
];

for (const path of PUBLIC_PAGES) {
  test(`no horizontal overflow: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
  });
}
```

- [ ] **Step 2: Run** — `npm run test:e2e -- e2e/public.spec.ts`
Expected: some FAIL (pages with current overflow). Record failures into `docs/mobile-audit.md`.

- [ ] **Step 3: Commit** (`test: public overflow smoke spec`)

---

## Phase 1 — Primitives

### Task 1.1: `Container`

**Files:**
- Create: `src/components/responsive/Container.tsx`
- Reference: `cn` from `src/lib/utils` (confirm path; shadcn convention is `@/lib/utils`)

- [ ] **Step 1: Write it**

```tsx
import { cn } from "@/lib/utils";

const SIZES = {
  narrow: "max-w-3xl",
  default: "max-w-5xl",
  wide: "max-w-7xl",
} as const;

export function Container({
  size = "default",
  className,
  children,
}: {
  size?: keyof typeof SIZES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", SIZES[size], className)}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit** (`feat: add Container primitive`)

---

### Task 1.2: `ResponsiveDialog`

**Files:**
- Create: `src/components/responsive/ResponsiveDialog.tsx`
- Reference: `src/components/ui/dialog.tsx`, `src/components/ui/sheet.tsx` (Sheet supports `side="bottom"`), `src/hooks/use-mobile.tsx`

- [ ] **Step 1: Write it**

```tsx
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription, SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

export function ResponsiveDialog({ open, onOpenChange, children }: Props) {
  const isMobile = useIsMobile();
  const Root = isMobile ? Sheet : Dialog;
  return <Root open={open} onOpenChange={onOpenChange}>{children}</Root>;
}

export function ResponsiveDialogTrigger(props: React.ComponentProps<typeof DialogTrigger>) {
  const isMobile = useIsMobile();
  const T = isMobile ? SheetTrigger : DialogTrigger;
  return <T {...props} />;
}

export function ResponsiveDialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogContent>) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <SheetContent
        side="bottom"
        className={cn("max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]", className)}
        {...(props as any)}
      >
        {children}
      </SheetContent>
    );
  }
  return (
    <DialogContent className={cn("max-h-[90dvh] overflow-y-auto", className)} {...props}>
      {children}
    </DialogContent>
  );
}

export function ResponsiveDialogHeader(props: React.ComponentProps<typeof DialogHeader>) {
  const isMobile = useIsMobile();
  const H = isMobile ? SheetHeader : DialogHeader;
  return <H {...props} />;
}
export function ResponsiveDialogFooter(props: React.ComponentProps<typeof DialogFooter>) {
  const isMobile = useIsMobile();
  const F = isMobile ? SheetFooter : DialogFooter;
  return <F {...props} />;
}
export function ResponsiveDialogTitle(props: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = useIsMobile();
  const T = isMobile ? SheetTitle : DialogTitle;
  return <T {...props} />;
}
export function ResponsiveDialogDescription(props: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = useIsMobile();
  const D = isMobile ? SheetDescription : DialogDescription;
  return <D {...props} />;
}
```

> Before using widely, open `src/components/ui/sheet.tsx` and confirm the exported names match (`SheetContent`, `SheetHeader`, etc.) and that `side` is a supported prop. Adjust imports if the local copy differs.

- [ ] **Step 2: Commit** (`feat: add ResponsiveDialog primitive`)

---

### Task 1.3: `ResponsiveTable`

**Files:**
- Create: `src/components/responsive/ResponsiveTable.tsx`
- Reference: shadcn-space `table-01` at `src/components/shadcn-space/blocks/table-01/table.tsx`

- [ ] **Step 1: Write it**

```tsx
import { cn } from "@/lib/utils";

/** Default: horizontal-scroll wrapper with edge fade. */
export function ResponsiveTable({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className={cn("w-full overflow-x-auto [-webkit-overflow-scrolling:touch]", className)}>
        {children}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/80 to-transparent md:hidden" />
    </div>
  );
}

/** Card-stack: render rows as cards under md, real table at md+. Use only where flagged. */
export function ResponsiveCards<T>({
  data, renderCard, renderTable,
}: {
  data: T[];
  renderCard: (row: T, i: number) => React.ReactNode;
  renderTable: () => React.ReactNode;
}) {
  return (
    <>
      <div className="space-y-3 md:hidden">{data.map(renderCard)}</div>
      <div className="hidden md:block">{renderTable()}</div>
    </>
  );
}
```

- [ ] **Step 2: Commit** (`feat: add ResponsiveTable primitive`)

---

### Task 1.4: `MobileBottomNav`

**Files:**
- Create: `src/components/responsive/MobileBottomNav.tsx`
- Reference: `src/components/dashboard/dashboardNav.ts` (existing nav items), `next/router`, `lucide-react`. Optionally install shadcn-space `apple-dock-01` via MCP `getBlockInstall` and restyle.

- [ ] **Step 1: Write it**

```tsx
import Link from "next/link";
import { useRouter } from "next/router";
import { Home, CalendarPlus, Ticket, Coffee, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/portal/dashboard", label: "Home", icon: Home },
  { href: "/portal/book", label: "Book", icon: CalendarPlus },
  { href: "/portal/bookings", label: "Bookings", icon: Ticket },
  { href: "/portal/menu", label: "Café", icon: Coffee },
  { href: "/portal/profile", label: "Profile", icon: User },
];

export function MobileBottomNav() {
  const router = useRouter();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-sage/15 bg-white/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = router.pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-body transition-colors",
                  active ? "text-terracotta" : "text-charcoal/55 hover:text-charcoal",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

> Confirm the 5 hrefs exist as routes. If `dashboardNav.ts` already lists member destinations, derive `ITEMS` from it to stay DRY.

- [ ] **Step 2: Commit** (`feat: add MobileBottomNav primitive`)

---

## Phase 2 — Shell integration

### Task 2.1: Wire bottom nav + fix popover width in `DashboardShell`

**Files:**
- Modify: `src/components/dashboard/DashboardShell.tsx`

- [ ] **Step 1: Render bottom nav for members on phones**

Import `MobileBottomNav` and `useIsMobile`. The shell already knows the role (`config`/role prop — confirm how role is read). Render at the end of the main content region:

```tsx
{role === "user" && <MobileBottomNav />}
```

- [ ] **Step 2: Add bottom clearance to main content**

On the `<main>`/content scroll container, add for members on phones:

```tsx
className={cn(existingClasses, role === "user" && "pb-20 md:pb-0")}
```

- [ ] **Step 3: Fix fixed-width popover (line ~116)**

Change `className="w-[380px] p-0"` → `className="w-[min(380px,calc(100vw-2rem))] p-0"`.

- [ ] **Step 4: Verify** — run member specs once these exist (Phase 5). For now: `npm run build` compiles. Manually open `/portal/dashboard` at 375px: bottom nav visible, content not hidden behind it.
- [ ] **Step 5: Commit** (`feat: member bottom nav + responsive popover in shell`)

---

### Task 2.2: Audit public `Navigation` touch targets

**Files:**
- Modify: `src/components/Navigation.tsx`

- [ ] **Step 1: Ensure tap targets ≥44px** — the hamburger button (`p-2.5`) is fine; verify mobile menu links have `py-3`+ for 44px height. Add where missing.
- [ ] **Step 2: Close menu on route change** — add:

```tsx
import { useRouter } from "next/router";
// inside component:
const router = useRouter();
useEffect(() => {
  const close = () => setMobileMenuOpen(false);
  router.events.on("routeChangeComplete", close);
  return () => router.events.off("routeChangeComplete", close);
}, [router.events]);
```

- [ ] **Step 3: Commit** (`fix: public nav touch targets + close on navigate`)

---

## Phase 3 — Calendars (highest risk)

### Task 3.1: `portal/book.tsx` week grid

**Files:**
- Modify: `src/pages/portal/book.tsx` (`grid-cols-7` at ~line 912)

- [ ] **Step 1: Write failing test** — add to `e2e/member.spec.ts` (created Phase 5; if running this first, stub the file):

```ts
test("book page no overflow", async ({ page }) => {
  await page.goto("/portal/book");
  await page.waitForLoadState("networkidle");
  await expectNoHorizontalScroll(page);
});
```

- [ ] **Step 2: Run, expect FAIL** (`grid-cols-7` overflows at 320px).
- [ ] **Step 3: Make week view responsive** — keep 7-col grid at `md+`; on phone render a horizontal snap day-scroller OR single-day list with a day picker. Pattern for snap scroller:

```tsx
<div className="flex gap-2 overflow-x-auto snap-x pb-2 md:grid md:grid-cols-7 md:overflow-visible">
  {days.map((d) => (
    <button key={d.iso} className="snap-center shrink-0 w-[44vw] sm:w-[30vw] md:w-auto ...">
      ...
    </button>
  ))}
</div>
```

- [ ] **Step 4: Run, expect PASS** at all viewports.
- [ ] **Step 5: Commit** (`fix: responsive week view on portal/book`)

---

### Task 3.2: `partner/classes.tsx` week grid

**Files:**
- Modify: `src/pages/partner/classes.tsx` (`grid-cols-7` at ~lines 186, 204, 209; `min-w-[180px]` at 172)

- [ ] **Step 1–4:** Same recipe as Task 3.1 applied to the partner calendar; relax `min-w-[180px]` title to `min-w-0 truncate` on phone. Gate with a partner overflow test (Phase 7 spec) or a temporary unauthenticated check if the page redirects.
- [ ] **Step 5: Commit** (`fix: responsive week view on partner/classes`)

---

## Phase 4 — Public pages sweep

> **Per-page recipe (apply to each page below):**
> 1. Add/confirm the page's path is in `e2e/public.spec.ts`. Run it → note overflow failures.
> 2. Fix offenders: non-responsive `grid-cols-N` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-N`; fixed `w-[NNNpx]` → `w-full max-w-[NNNpx]` or responsive; wide selects (`w-[180px]`) → `w-full sm:w-[180px]`; wrap any data table in `ResponsiveTable`; wrap page body in `Container` where it hand-rolls padding.
> 3. Re-run the page's overflow test at 320/390/768 → PASS.
> 4. Commit per page (`fix(mobile): <page>`).

### Task 4.1: `index.tsx` (+ section components: Hero, Experience, Pricing, Testimonial, Instructors, Boutique, Footer)
**Files:** `src/pages/index.tsx` and the section components it renders. Known offender: `Instructors.tsx` `w-[500px]`/`w-[600px]` decorative blobs (clip with `overflow-hidden` on section + `max-w-full`), `w-[260px]` cards (already scroll-snap — verify). Apply recipe. Commit.

### Task 4.2: `classes.tsx`
Known: `SelectTrigger w-[180px]` / `w-[280px]` (line 544/560) → `w-full sm:w-[180px]`. Apply recipe. Commit.

### Task 4.3: `cafe.tsx`
Known: card scroller `w-[260px] sm:w-[280px] md:w-[300px]` already responsive — verify no parent overflow. Apply recipe. Commit.

### Task 4.4: `shop.tsx` + `shop/[id].tsx`
Product grid + detail. Apply recipe; ensure image + add-to-cart layout stacks. Commit.

### Task 4.5: `rental.tsx`, `founder.tsx`
`founder.tsx` `grid-cols-3` (line 94) → `grid-cols-1 sm:grid-cols-3`. Apply recipe. Commit.

### Task 4.6: `policy.tsx`, `terms.tsx`, `meal-subscription.tsx`
Mostly prose. Wrap in `Container size="narrow"`; verify tables/embeds. Commit.

### Task 4.7: `login.tsx`, `signup.tsx`, `checkin.tsx`
Auth pages have animated mesh backgrounds — confirm they don't force width; card centers and fits 320px. `checkin.tsx` `CheckinQrDialog` uses `h-[240px] w-[240px]` QR — fine but ensure dialog fits (adopt `ResponsiveDialog`). Commit.

- [ ] **Phase 4 gate:** `npm run test:e2e -- e2e/public.spec.ts` → all PASS at all three projects.

---

## Phase 5 — Member portal sweep

### Task 5.0: Member spec
**Files:** Create `e2e/member.spec.ts`

- [ ] **Step 1: Write it**

```ts
import { test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers/viewport";
import { STATE } from "./helpers/auth";

test.use({ storageState: STATE.member });

const PAGES = [
  "/portal/dashboard", "/portal/book", "/portal/bookings",
  "/portal/packages", "/portal/profile", "/portal/menu", "/portal/onboarding",
];
for (const path of PAGES) {
  test(`member no overflow: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
  });
}
test("member bottom nav visible on phone", async ({ page }) => {
  await page.goto("/portal/dashboard");
  // only assert on phone projects
  const nav = page.locator("nav.fixed.bottom-0");
  if (page.viewportSize()!.width < 768) await nav.waitFor({ state: "visible" });
});
```

- [ ] **Step 2: Run → record failures. Commit** (`test: member overflow spec`).

### Task 5.1: `portal/dashboard.tsx`
Known: `PathToMastery.tsx` `min-w-[520px]` (already inside a scroll area? confirm) — wrap in `ResponsiveTable`/overflow scroll. Apply recipe. Commit.

### Task 5.2: `portal/packages.tsx`
Has a table → wrap in `ResponsiveTable`. 3 dialogs → swap to `ResponsiveDialog`. Apply recipe. Commit.

### Task 5.3: `portal/bookings.tsx`
3 dialogs → `ResponsiveDialog`. Apply recipe. Commit.

### Task 5.4: `portal/profile.tsx`
`max-w-[200px] truncate` ok. Forms stack. Apply recipe. Commit.

### Task 5.5: `portal/menu.tsx`, `portal/onboarding.tsx`
`onboarding.tsx` `grid-cols-3` (line 300) → responsive. Apply recipe. Commit.

- [ ] **Phase 5 gate:** `npm run test:e2e -- e2e/member.spec.ts` → all PASS.

---

## Phase 6 — Admin sweep

### Task 6.0: Admin spec
**Files:** Create `e2e/admin.spec.ts` (mirror member spec, `storageState: STATE.admin`, pages: `/admin/dashboard`, `/admin/members`, `/admin/schedule`, `/admin/products`, `/admin/CRM`, `/admin/control`, `/admin/cafe`, `/admin/badges`, `/admin/credits`, `/admin/partners`). Run → record failures. Commit.

### Task 6.1: `admin/dashboard.tsx` (largest — 4400+ lines, 17 dialogs)
- Swap all `Dialog`/`DialogContent` → `ResponsiveDialog`/`ResponsiveDialogContent` (mechanical import rename; do in batches, re-run overflow test after each batch).
- `grid-cols-3` (lines ~3992, 4434) → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- Wrap data tables in `ResponsiveTable`.
- Commit in logical batches (`fix(mobile): admin dashboard dialogs`, `...grids`, `...tables`).

### Task 6.2: `admin/members.tsx`
7 dialogs → `ResponsiveDialog`. `grid-cols-4` (1167/1191) → responsive. `TabsList grid-cols-4` (1370) → keep but ensure it fits / horizontal scroll. Table head fixed widths (`w-[180px]` etc.) inside `ResponsiveTable` are fine. Commit.

### Task 6.3: `admin/schedule.tsx`
5 dialogs → `ResponsiveDialog`. `DayScheduleList.tsx` table → `ResponsiveTable`; relax `min-w-[160px]` progress bar. Commit.

### Task 6.4: `admin/products.tsx`
Table → `ResponsiveTable`. Apply recipe. Commit.

### Task 6.5: `admin/CRM.tsx`
`min-w-[140px]` code chips ok inside scroll. Apply recipe. Commit.

### Task 6.6: `admin/control.tsx` (15 dialogs)
Swap dialogs → `ResponsiveDialog`. Apply recipe. Commit.

### Task 6.7: `admin/cafe.tsx`, `admin/badges.tsx`, `admin/credits.tsx`, `admin/partners.tsx`
Apply recipe per page (dialogs → `ResponsiveDialog`, tables → `ResponsiveTable`, grids responsive). Commit per page.

- [ ] **Phase 6 gate:** `npm run test:e2e -- e2e/admin.spec.ts` → all PASS.

---

## Phase 7 — Partner + Instructor sweep

### Task 7.0: Partner/instructor specs + seed linkage
**Files:** Modify `scripts/seed-e2e-users.ts` to also create a partner manager (Profile role `partner` + `Partner` + `PartnerMember`) and an instructor (Profile role `instructor` + `Instructor.profile_id`). Read `prisma/schema.prisma` for required fields. Add `STATE.partner`/`STATE.instructor` + `loginAndSave` calls in `global-setup.ts`. Create `e2e/partner.spec.ts` + `e2e/instructor.spec.ts`. Commit.

### Task 7.1: `partner/dashboard.tsx`, `partner/settings.tsx`, `partner/members.tsx`
`partner/members.tsx` table → `ResponsiveTable`. Apply recipe. (Calendar in `partner/classes.tsx` already done in Phase 3.) Commit per page.

### Task 7.2: `instructor/dashboard.tsx`
`grid-cols-3` (line 247) → responsive. Apply recipe. Commit.

- [ ] **Phase 7 gate:** partner + instructor specs PASS.

---

## Phase 8 — Final sweep & docs

### Task 8.1: Full suite green
- [ ] Run `npm run test:e2e` (all projects, all specs) → all PASS. Fix stragglers.

### Task 8.2: Docs
**Files:** Modify `.llm/commands.md` (add `npm run test:e2e`), `.llm/conventions.md` (note `src/components/responsive/` primitives + "use `ResponsiveDialog`/`ResponsiveTable` for new dialogs/tables"). Recompress per `.llm` caveman convention. Commit.

### Task 8.3: Manual device pass
- [ ] Open key flows (book a class, admin manage member, partner roster) on a real phone or devtools device mode at 320/390/768. Confirm bottom nav, dialogs-as-sheets, table scroll, calendars. Note anything tests missed.

---

## Self-Review (completed by author)

- **Spec coverage:** primitives (1.x), shell + bottom nav (2.1), public nav (2.2), calendars (3.x), public/member/admin/partner/instructor sweeps (4–7), Playwright + auth fixture (0.x), shadcn-space usage (1.4 apple-dock, 1.3 table-01), docs (8.2). All spec sections mapped.
- **Placeholder scan:** Per-page tasks intentionally reference the audit recipe + named offenders with line numbers rather than pre-written diffs, because exact classNames require reading each file at edit time; the recipe + Playwright gate make each task concretely verifiable. Foundation tasks (0–3) contain full code.
- **Type consistency:** Primitive export names (`ResponsiveDialog*`, `ResponsiveTable`/`ResponsiveCards`, `MobileBottomNav`, `Container`) used consistently across phases; `expectNoHorizontalScroll`/`STATE` helpers reused by all specs.
- **Known brittle spot:** login selectors in `e2e/helpers/auth.ts` — flagged to verify against `src/pages/login.tsx` on first run.
