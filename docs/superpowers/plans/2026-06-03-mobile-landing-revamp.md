# Mobile Landing Page Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile (`< md` / `< 768px`) presentation of the public landing page (`/`) feel impeccable — lead with the message + a clear Book path, add a persistent bottom CTA, hide dead sections, and de-clutter carousels — while leaving desktop (`md+`) pixel-identical.

**Architecture:** All changes are mobile-breakpoint-only (unprefixed Tailwind values, `lg:hidden`/`hidden lg:*` splits, or `md:hidden` new components). The desktop 3-column hero is wrapped `hidden lg:block` and untouched internally; a new message-first mobile hero replaces the old below-the-fold headline section. A new `MobileStickyCTA` component (`md:hidden`) floats a Book CTA after the hero. Carousel arrow controls are hidden `< md`, relying on existing native swipe + the existing scroll-synced progress bar.

**Tech Stack:** Next.js 15 (Pages Router), React 18, TypeScript, Tailwind v4, `next-auth/react`, `lucide-react`. No unit-test runner exists in this repo, so verification per task is **agent-browser visual capture** (mobile correctness + desktop-unchanged) plus `npm run lint`.

---

## Conventions for every task

- **Dev server** is already running at `http://localhost:3000` (`npm run dev:next`). If not: `npm run dev:next`.
- **agent-browser** is installed (`agent-browser --version` → 0.27.1). Mobile device = `iPhone 14`. Desktop = viewport `1280 800`.
- **Commits are GATED**: the repo owner's standing preference is *never auto-commit; run git only on explicit request*. Each task ends with a prepared commit command — **do not run it until the user says so**. Stage nothing automatically.
- **Hard constraint:** after every task, the desktop (`md+`) render of the touched component must be visually identical to `main`. The desktop-diff step in each task enforces this.

### Reusable verification snippets

Capture **mobile**:
```bash
cd /Users/lawbringr/IdeaProjects/ikara/Copper-Cloves
D=/Users/lawbringr/IdeaProjects/ikara/Copper-Cloves/.audit
agent-browser set device "iPhone 14" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
# scroll helper: agent-browser eval "window.scrollTo(0,<Y>)" then screenshot to absolute path
```

Capture **desktop** (must match baseline):
```bash
agent-browser set viewport 1280 800 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser screenshot "$D/desktop-after-<name>.png" >/dev/null
```
Then Read the before/after desktop PNGs and confirm no visual difference.

> Note: `agent-browser screenshot` requires an **absolute** path; relative paths are silently ignored.

---

## Task 1: Desktop baseline capture (regression reference)

Capture golden desktop screenshots of every section **before** any edit, so later tasks can prove desktop is unchanged.

**Files:** none modified (capture only, into `.audit/baseline/`).

- [ ] **Step 1: Capture desktop baselines at 1280px**

```bash
cd /Users/lawbringr/IdeaProjects/ikara/Copper-Cloves
B=/Users/lawbringr/IdeaProjects/ikara/Copper-Cloves/.audit/baseline
mkdir -p "$B"
agent-browser set viewport 1280 800 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
for i in $(seq 0 12); do
  agent-browser eval "window.scrollTo(0,$((i*760)))" >/dev/null
  agent-browser eval "new Promise(r=>setTimeout(r,350))" >/dev/null
  agent-browser screenshot "$B/d$(printf '%02d' $i).png" >/dev/null
done
ls "$B" | wc -l
```
Expected: 13 PNGs in `.audit/baseline/`.

- [ ] **Step 2: Confirm `.audit/` is git-ignored**

Run: `git check-ignore .audit/baseline/d00.png && echo IGNORED || echo "NOT IGNORED — add .audit/ to .gitignore"`
If NOT IGNORED, add `.audit/` to `.gitignore` (this is the only file change in this task) so screenshots never get committed.

- [ ] **Step 3 (gated): Commit only if .gitignore changed**

```bash
git add .gitignore
git commit -m "chore: ignore .audit screenshot scratch dir"
```

---

## Task 2: Message-first mobile hero (`Hero.tsx`)

**Files:**
- Modify: `src/components/Hero.tsx`

Make the desktop video hero desktop-only, and replace the old `lg:hidden` headline section with a message-first mobile hero: headline → `move · refuel · connect` → compact 3-tile video triptych → **Book a class** (sage) + **Explore classes** (ghost).

- [ ] **Step 1: Baseline — capture the current mobile hero (shows the problem)**

```bash
cd /Users/lawbringr/IdeaProjects/ikara/Copper-Cloves
D=/Users/lawbringr/IdeaProjects/ikara/Copper-Cloves/.audit
agent-browser set device "iPhone 14" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "window.scrollTo(0,0)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,400))" >/dev/null
agent-browser screenshot "$D/hero-before.png" >/dev/null
```
Read `$D/hero-before.png`. Expected: three stacked videos, no headline/CTA above the fold (the problem we are fixing).

- [ ] **Step 2: Add `useSession` import and wrap the desktop hero section `hidden lg:block`**

In `src/components/Hero.tsx`:

Add to the top imports (after the existing `import` lines):
```tsx
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Ticket, ArrowRight } from "lucide-react";
```

Inside `export function Hero()`, add at the top of the function body (before the `useEffect`s):
```tsx
  const { status } = useSession();
  const bookHref = status === "authenticated" ? "/portal/book" : "/login";
```

Change the opening of the desktop video section from:
```tsx
      <section className="relative h-screen w-full overflow-hidden">
```
to:
```tsx
      <section className="relative hidden h-screen w-full overflow-hidden lg:block">
```
(Everything inside this section, including the `hidden lg:flex` desktop headline overlay and the `<style jsx>` block, stays exactly as-is.)

- [ ] **Step 3: Replace the old mobile headline section with the new mobile hero**

Replace this entire block (the second `<section>`, currently lines ~198–213):
```tsx
      {/* Headline — mobile / tablet only (under hero stack) */}
      <section className="bg-white py-8 sm:py-10 lg:hidden px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl text-charcoal mb-6 leading-[1.05]">
            <span className="italic text-charcoal/70">We're more than a studio,</span><br />
            We're your home away from home
          </h1>
          <p className="font-body text-lg sm:text-xl md:text-2xl text-charcoal/80 font-light leading-relaxed max-w-2xl mx-auto">
            <span className="italic">move</span> your body,{" "}
            <span className="italic">refuel</span> with a coffee and a smoothie bowl,
            <br className="hidden sm:block" />
            work from our cafe and find your{" "}
            <span className="italic">community</span>
          </p>
        </div>
      </section>
```
with:
```tsx
      {/* Mobile / tablet hero — message-first over a compact video triptych (< lg) */}
      <section className="relative flex min-h-[100svh] flex-col justify-center bg-cream px-6 pb-10 pt-24 lg:hidden">
        <div className="mx-auto w-full max-w-2xl text-center">
          <h1 className="font-display text-[clamp(2.25rem,8.5vw,3.5rem)] leading-[1.05] text-charcoal">
            <span className="italic text-charcoal/70">We&apos;re more than a studio,</span>
            <br />
            We&apos;re your home away from home
          </h1>

          <p className="mt-4 font-script text-2xl tracking-wider text-sage">
            move · refuel · connect
          </p>

          <p className="mx-auto mt-3 max-w-md font-body text-base leading-relaxed text-charcoal/70">
            <span className="italic">Move</span> your body, <span className="italic">refuel</span> with a coffee and a smoothie bowl, and find your <span className="italic">community</span>.
          </p>

          {/* Compact video triptych */}
          <div className="mt-6 grid grid-cols-3 gap-2">
            {[
              { src: moveMedia[0], label: "move", anim: "animate-floatAndZoom17" },
              { src: refuelMedia[0], label: "refuel", anim: "animate-floatAndZoom19" },
              { src: cdnUrl("/Connect-1.mp4"), label: "connect", anim: "animate-floatAndZoom23" },
            ].map((tile) => (
              <div key={tile.label} className="relative h-44 overflow-hidden rounded-2xl">
                <video
                  src={tile.src}
                  poster={tile.src.replace(/\.mp4$/, ".poster.jpg")}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="none"
                  className={`h-full w-full object-cover ${tile.anim}`}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent" />
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 font-script text-sm text-white/95">
                  {tile.label}
                </span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={bookHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7A8B7C] px-6 py-3.5 font-body text-base font-medium text-cream shadow-sm transition-colors hover:bg-[#6d7c6e] active:bg-[#637069]"
            >
              <Ticket size={18} /> Book a class
            </Link>
            <Link
              href="/classes"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-sage/40 px-6 py-3.5 font-body text-base font-medium text-sage transition-colors hover:bg-sage/5"
            >
              Explore classes
              <ArrowRight size={16} className="motion-reduce:transition-none" />
            </Link>
          </div>
        </div>
      </section>
```

Note: the `move · refuel · connect` glyph uses a middle dot `·`. The triptych reuses the existing `moveMedia`, `refuelMedia` constants and `floatAndZoom` keyframes (defined in the `<style jsx>` inside the desktop section, which is always rendered in the DOM even when `hidden`, so the animation classes resolve).

- [ ] **Step 4: Lint**

Run: `npm run lint -- --file src/components/Hero.tsx` (or `npm run lint`)
Expected: no new errors for `Hero.tsx`.

- [ ] **Step 5: Verify mobile (problem fixed)**

```bash
cd /Users/lawbringr/IdeaProjects/ikara/Copper-Cloves
D=/Users/lawbringr/IdeaProjects/ikara/Copper-Cloves/.audit
agent-browser set device "iPhone 14" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "window.scrollTo(0,0)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,500))" >/dev/null
agent-browser screenshot "$D/hero-after.png" >/dev/null
```
Read `$D/hero-after.png`. Expected: headline + `move·refuel·connect` + 3 video tiles + **Book a class** + **Explore classes** all visible above the fold. Also capture at 360px: `agent-browser set viewport 360 800` then re-open + screenshot — headline must not overflow horizontally.

- [ ] **Step 6: Verify desktop unchanged**

```bash
agent-browser set viewport 1280 800 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "window.scrollTo(0,0)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,500))" >/dev/null
agent-browser screenshot "$D/desktop-hero-after.png" >/dev/null
```
Read `$D/desktop-hero-after.png` and compare to `.audit/baseline/d00.png`. Expected: identical 3-column video hero with the floating headline.

- [ ] **Step 7 (gated): Commit**

```bash
git add src/components/Hero.tsx
git commit -m "feat(mobile): message-first landing hero with CTAs over video triptych"
```

---

## Task 3: Persistent mobile Book CTA (`MobileStickyCTA.tsx`)

**Files:**
- Create: `src/components/MobileStickyCTA.tsx`
- Modify: `src/pages/index.tsx`

A fixed bottom bar (`md:hidden`) that slides up after the user scrolls past the hero. Primary **Book a class** (authed → `/portal/book`, guest → `/classes` per the browse-first decision) + a quieter **Pricing** link.

- [ ] **Step 1: Create the component**

Create `src/components/MobileStickyCTA.tsx`:
```tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Fixed bottom Book CTA for phones (`md:hidden`). Hidden over the hero, slides
 * up once the user scrolls roughly one screen down. The full-screen mobile nav
 * sheet (z-[60], opaque cream) fully covers this (z-40), so no shared state is
 * needed to hide it while the menu is open.
 */
export function MobileStickyCTA() {
  const { status } = useSession();
  const bookHref = status === "authenticated" ? "/portal/book" : "/classes";
  const [show, setShow] = useState(false);

  // rAF-throttled, compare-and-skip (mirrors Navigation.tsx scroll handling).
  useEffect(() => {
    let ticking = false;
    let last = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const next = window.scrollY > window.innerHeight * 0.9;
        if (next !== last) {
          last = next;
          setShow(next);
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!show}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 md:hidden",
        "border-t border-sage/15 bg-[#fafaf8]/95 backdrop-blur-md",
        "px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]",
        "transition-transform duration-300 ease-out motion-reduce:transition-none",
        show ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
    >
      <div className="mx-auto flex max-w-md items-center gap-3">
        <Link
          href={bookHref}
          tabIndex={show ? 0 : -1}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-3.5",
            "font-body text-base font-medium text-cream shadow-sm",
            "bg-[#7A8B7C] transition-colors hover:bg-[#6d7c6e] active:bg-[#637069]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A8B7C]/40",
          )}
        >
          <Ticket size={18} /> Book a class
        </Link>
        <Link
          href="/pricing"
          tabIndex={show ? 0 : -1}
          className="shrink-0 px-3 py-3.5 font-body text-base font-medium text-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A8B7C]/40 focus-visible:rounded-full"
        >
          Pricing
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount it in the landing page**

In `src/pages/index.tsx`, add the import alongside the other static imports:
```tsx
import { MobileStickyCTA } from "@/components/MobileStickyCTA";
```
Add it just after `<Footer />`, still inside the `min-h-screen` wrapper:
```tsx
        <Boutique />
        <Footer />
        <MobileStickyCTA />
      </div>
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Verify mobile behavior**

```bash
cd /Users/lawbringr/IdeaProjects/ikara/Copper-Cloves
D=/Users/lawbringr/IdeaProjects/ikara/Copper-Cloves/.audit
agent-browser set device "iPhone 14" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
# at top: bar hidden
agent-browser eval "window.scrollTo(0,0)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,400))" >/dev/null
agent-browser screenshot "$D/sticky-top.png" >/dev/null
# scrolled down: bar visible
agent-browser eval "window.scrollTo(0,2000)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,500))" >/dev/null
agent-browser screenshot "$D/sticky-scrolled.png" >/dev/null
```
Read both. Expected: `sticky-top.png` has no bottom bar; `sticky-scrolled.png` shows the **Book a class** + **Pricing** bar pinned to the bottom. Then verify the guest target: `agent-browser get attr` on the Book link resolves to `/classes` while logged out.

- [ ] **Step 5: Verify nav sheet covers it**

Open the hamburger menu while scrolled down and screenshot. Expected: the full-screen cream nav sheet covers the sticky bar (no bleed-through).

- [ ] **Step 6: Verify desktop unaffected**

```bash
agent-browser set viewport 1280 800 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "window.scrollTo(0,2000)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,400))" >/dev/null
agent-browser screenshot "$D/desktop-sticky-check.png" >/dev/null
```
Read it. Expected: **no** bottom bar on desktop (component is `md:hidden`).

- [ ] **Step 7 (gated): Commit**

```bash
git add src/components/MobileStickyCTA.tsx src/pages/index.tsx
git commit -m "feat(mobile): persistent bottom Book CTA on landing page"
```

---

## Task 4: Hide Boutique when empty (`Boutique.tsx`)

**Files:**
- Modify: `src/components/Boutique.tsx`

Kill the ~1700px "Products will appear here once added in admin" dead zone by rendering nothing when there are no products.

- [ ] **Step 1: Early-return null when empty**

In `src/components/Boutique.tsx`, immediately before the `return (` of the component body, add:
```tsx
  // No products → render nothing on the public landing page (was a dead
  // "added in admin" placeholder). Stays hidden during the initial fetch too.
  if (products.length === 0) return null;
```
Then delete the now-dead empty-state branch inside the track — replace:
```tsx
            {products.length === 0 ? (
              <p className="w-full py-12 text-center font-body text-charcoal/60">
                Products will appear here once added in admin.
              </p>
            ) : (
              products.map((product) => (
```
with:
```tsx
            {products.map((product) => (
```
and remove the corresponding closing `)}` of the ternary (the `))` after the map stays, but the trailing `)` that closed the ternary is deleted). After editing, the map block should read `{products.map((product) => ( ... ))}`.

- [ ] **Step 2: Lint + typecheck the edited file**

Run: `npm run lint`
Expected: no new errors; no unbalanced-JSX syntax error in `Boutique.tsx`.

- [ ] **Step 3: Verify empty state hides (mobile + desktop)**

With no retail products in the local DB, load the page and confirm the Boutique section is absent on both `iPhone 14` and `1280×800`. Capture `$D/boutique-empty-mobile.png`; Read it — the footer should follow Rental/Founder with no boutique placeholder.

- [ ] **Step 4: Verify non-empty still renders (guard against over-hiding)**

If any retail product exists (or temporarily stub `/api/retail-products` to return one), confirm the Boutique section renders normally on desktop, matching `.audit/baseline` (the section appears only when products exist — baseline was also empty, so this is a manual reasoning check, not a pixel diff).

- [ ] **Step 5 (gated): Commit**

```bash
git add src/components/Boutique.tsx
git commit -m "fix(mobile): hide boutique section when no products"
```

---

## Task 5: De-clutter carousels — hide arrows `< md` (shared `CarouselControls`)

**Files:**
- Modify: `src/components/CarouselControls.tsx`

`ClassCatalog` and `Instructors` both render `<CarouselControls>` (prev button · progress bar · next button). On mobile, hide the two buttons and keep the centered progress bar as the position indicator. Native swipe already works. Desktop keeps arrows.

- [ ] **Step 1: Hide the buttons below `md` in the shared `btn` class**

In `src/components/CarouselControls.tsx`, change the `btn` constant from:
```tsx
  const btn =
    "flex h-11 w-11 items-center justify-center rounded-full border border-sage/25 bg-white-warm text-sage transition-all duration-200 ease-out hover:border-sage/50 hover:bg-sage/10 hover:text-[#7A8B7C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-sage/25 disabled:hover:bg-white-warm";
```
to:
```tsx
  const btn =
    "hidden h-11 w-11 items-center justify-center rounded-full border border-sage/25 bg-white-warm text-sage transition-all duration-200 ease-out hover:border-sage/50 hover:bg-sage/10 hover:text-[#7A8B7C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-sage/25 disabled:hover:bg-white-warm md:flex";
```
(Only change: `flex` → `hidden ... md:flex`. The progress bar in the middle is untouched and shows on all breakpoints.)

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Verify mobile (arrows gone, bar stays, swipe works)**

```bash
cd /Users/lawbringr/IdeaProjects/ikara/Copper-Cloves
D=/Users/lawbringr/IdeaProjects/ikara/Copper-Cloves/.audit
agent-browser set device "iPhone 14" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
# scroll to the Classes carousel controls (~y=2500) and Instructors (~y=3700)
agent-browser eval "window.scrollTo(0,2500)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,400))" >/dev/null
agent-browser screenshot "$D/classes-controls-mobile.png" >/dev/null
```
Read it. Expected: a centered progress bar, **no** circular ‹ › buttons. Optionally swipe the track (`agent-browser eval` a horizontal `scrollBy` on the track) and confirm the bar fills.

- [ ] **Step 4: Verify desktop unchanged (arrows still present)**

```bash
agent-browser set viewport 1280 800 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "window.scrollTo(0,1900)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,400))" >/dev/null
agent-browser screenshot "$D/classes-controls-desktop.png" >/dev/null
```
Read it and compare to the matching baseline frame. Expected: ‹ › buttons + bar both present, identical to baseline.

- [ ] **Step 5 (gated): Commit**

```bash
git add src/components/CarouselControls.tsx
git commit -m "fix(mobile): hide carousel arrow buttons under md, keep progress bar"
```

---

## Task 6: Pricing carousel — hide arrows `< md`, add mobile progress bar (`Pricing.tsx`)

**Files:**
- Modify: `src/components/Pricing.tsx`

Pricing uses its own `NavPrevButton`/`NavNextButton` shown `lg:hidden` (mobile **and** tablet). Tablet is `md+` and must stay unchanged, so hide the arrows only `< md`, and add a `md:hidden` progress bar driven by the shared `useCarouselScroll` hook (so mobile still gets position feedback). Desktop/tablet behavior is preserved (same buttons, same smooth scroll).

- [ ] **Step 1: Swap the local ref/scroll for the shared hook**

In `src/components/Pricing.tsx`:

Add the import:
```tsx
import { useCarouselScroll } from "@/hooks/useCarouselScroll";
```
Remove `useRef` from the React import if it becomes unused (keep `useState`, `useEffect`).

Replace:
```tsx
  const scrollContainerRef = useRef<HTMLDivElement>(null);
```
with:
```tsx
  const { ref: scrollContainerRef, scrollBy, measure, progress } = useCarouselScroll();
```

Replace the `scroll` helper:
```tsx
  const scroll = (direction: "left" | "right") => {
    scrollContainerRef.current?.scrollBy({
      left: direction === "left" ? -350 : 350,
      behavior: "smooth",
    });
  };
```
with:
```tsx
  const scroll = (direction: "left" | "right") => scrollBy(direction, 350);
```

Add a re-measure when the tier toggles (cards change), after the `currentPlans` line:
```tsx
  useEffect(() => {
    measure();
  }, [selectedTier, measure]);
```
(Add `useEffect` to the React import if not present.)

- [ ] **Step 2: Hide the arrow row `< md`, add a mobile progress bar**

Change the arrow row from:
```tsx
        {/* Mobile scroll controls */}
        <div className="mt-8 flex justify-center gap-4 lg:hidden">
          <NavPrevButton onClick={() => scroll("left")} className="rounded-full bg-white-warm" />
          <NavNextButton onClick={() => scroll("right")} className="rounded-full bg-white-warm" />
        </div>
```
to:
```tsx
        {/* Tablet scroll controls (md–lg): arrows hidden on phones */}
        <div className="mt-8 hidden justify-center gap-4 md:flex lg:hidden">
          <NavPrevButton onClick={() => scroll("left")} className="rounded-full bg-white-warm" />
          <NavNextButton onClick={() => scroll("right")} className="rounded-full bg-white-warm" />
        </div>

        {/* Phone position indicator (< md) */}
        <div className="mt-8 flex justify-center md:hidden">
          <div className="h-1 w-24 overflow-hidden rounded-full bg-sage/15" aria-hidden="true">
            <div
              className="h-full rounded-full bg-sage transition-[width] duration-300 ease-out"
              style={{ width: `${Math.max(14, progress * 100)}%` }}
            />
          </div>
        </div>
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors; no unused `useRef`/`NavPrevButton` warnings (both still used).

- [ ] **Step 4: Verify mobile (no arrows, bar present + tracks scroll)**

Capture at `iPhone 14` scrolled to the Pricing section (~y=6200). Read the screenshot. Expected: tier toggle, a thin progress bar, **no** circular arrow buttons; swiping the cards fills the bar.

- [ ] **Step 5: Verify tablet + desktop unchanged**

- Tablet: `agent-browser set viewport 800 1000`, open, scroll to pricing, screenshot. Expected: the ‹ › NavPrev/Next buttons are present (md–lg range), exactly as before.
- Desktop: `agent-browser set viewport 1280 800`, scroll to pricing, screenshot, compare to baseline. Expected: 4-column grid, no arrows, identical to baseline.

- [ ] **Step 6 (gated): Commit**

```bash
git add src/components/Pricing.tsx
git commit -m "fix(mobile): pricing — hide arrows under md, add phone progress bar"
```

---

## Task 7: Mobile vertical rhythm tighten (mobile-only padding)

**Files:**
- Modify: `src/components/Experience.tsx`, `src/components/ClassCatalog.tsx`, `src/components/Instructors.tsx`, `src/components/Testimonial.tsx`, `src/components/Pricing.tsx`, `src/components/Founder.tsx`, `src/components/Boutique.tsx`

These sections currently use `py-16 md:py-20`. Tighten the **mobile** value from `py-16` (64px) to `py-14` (56px) for a slightly denser scroll, leaving the desktop `md:py-20` untouched.

- [ ] **Step 1: Change `py-16 md:py-20` → `py-14 md:py-20` in each section's root `<section>`**

For each file above, locate the top-level `<section ... className="... py-16 md:py-20 ...">` and change only `py-16` → `py-14`. Do **not** touch any `md:`/`lg:` padding. Exact occurrences:
- `Experience.tsx`: `className="py-16 md:py-20 px-6 lg:px-8 ..."` → `py-14 md:py-20`.
- `ClassCatalog.tsx`: `className="relative overflow-hidden bg-cream py-16 md:py-20"` → `py-14 md:py-20`.
- `Instructors.tsx`: `className="bg-cream py-16 md:py-20"` → `py-14 md:py-20`.
- `Testimonial.tsx`: `className="py-16 md:py-20 bg-sage ..."` → `py-14 md:py-20`.
- `Pricing.tsx`: `className="bg-cream py-16 md:py-20"` → `py-14 md:py-20`.
- `Founder.tsx`: `className="bg-cream py-16 md:py-20"` → `py-14 md:py-20`.
- `Boutique.tsx`: `className="relative py-16 md:py-20 bg-cream overflow-hidden"` → `py-14 md:py-20`.

(`Rental.tsx` and `Footer.tsx`: open each and only adjust if they also use `py-16 md:py-20`; otherwise leave them. Do not introduce new desktop changes.)

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Verify desktop unchanged (critical — many files touched)**

```bash
cd /Users/lawbringr/IdeaProjects/ikara/Copper-Cloves
B=/Users/lawbringr/IdeaProjects/ikara/Copper-Cloves/.audit/baseline
A=/Users/lawbringr/IdeaProjects/ikara/Copper-Cloves/.audit/after7
mkdir -p "$A"
agent-browser set viewport 1280 800 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
for i in $(seq 0 12); do
  agent-browser eval "window.scrollTo(0,$((i*760)))" >/dev/null
  agent-browser eval "new Promise(r=>setTimeout(r,350))" >/dev/null
  agent-browser screenshot "$A/d$(printf '%02d' $i).png" >/dev/null
done
```
Read several `after7/dNN.png` vs `baseline/dNN.png`. Expected: identical (the `md:py-20` desktop padding is unchanged; only mobile `py-14` differs, which is invisible at 1280px).

- [ ] **Step 4: Verify mobile rhythm**

Capture a full set of `iPhone 14` frames and skim them. Expected: consistent, slightly tighter section spacing; nothing clipped or overlapping.

- [ ] **Step 5 (gated): Commit**

```bash
git add src/components/Experience.tsx src/components/ClassCatalog.tsx src/components/Instructors.tsx src/components/Testimonial.tsx src/components/Pricing.tsx src/components/Founder.tsx src/components/Boutique.tsx
git commit -m "style(mobile): tighten section vertical rhythm to py-14 on phones"
```

---

## Task 8: Final full-page audit + desktop regression gate

**Files:** none modified (verification only).

- [ ] **Step 1: Full mobile sweep at 390px**

```bash
cd /Users/lawbringr/IdeaProjects/ikara/Copper-Cloves
F=/Users/lawbringr/IdeaProjects/ikara/Copper-Cloves/.audit/final
mkdir -p "$F"
agent-browser set device "iPhone 14" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
H=$(agent-browser eval "document.body.scrollHeight" | tail -1 | tr -dc 0-9)
n=0; y=0
while [ "$y" -lt "$H" ]; do
  agent-browser eval "window.scrollTo(0,$y)" >/dev/null
  agent-browser eval "new Promise(r=>setTimeout(r,350))" >/dev/null
  agent-browser screenshot "$F/m$(printf '%02d' $n).png" >/dev/null
  n=$((n+1)); y=$((y+800))
done
echo "captured $n frames; page height $H"
```
Read the frames. Checklist: hero shows message+CTAs above fold; sticky bar appears after hero and routes correctly; no Boutique dead zone; carousels show progress bar, no arrows; spacing consistent; nothing clipped at the bottom safe-area.

- [ ] **Step 2: Small-phone pass at 360px**

Repeat at `agent-browser set viewport 360 800`. Expected: no horizontal overflow, hero headline fits, CTAs full-width and tappable (≥44px).

- [ ] **Step 3: Desktop regression gate at 1280px**

Re-capture the full desktop set and compare frame-by-frame to `.audit/baseline`. Expected: **every** frame identical. Any difference is a regression — fix before finishing.

- [ ] **Step 4: Reduced-motion + lint**

- `agent-browser set media reduced-motion` (if supported) or emulate, reload, confirm the sticky bar appears without animated slide and videos still render.
- Run `npm run lint` once more. Expected: clean on all touched files.

- [ ] **Step 5: Finish**

Use the `superpowers:finishing-a-development-branch` skill to decide how to integrate (the branch `feat/mobile-landing-revamp` is already created). Commits remain gated on the user's explicit request.

---

## Self-review notes (author)

- **Spec coverage:** Hero message-first (Task 2) ✓; sticky CTA (Task 3) ✓; Boutique empty-hide (Task 4) ✓; carousels swipe + position indicator (Tasks 5–6) ✓; rhythm (Task 7) ✓; polish/touch-targets/reduced-motion (Tasks 2,3,8) ✓; desktop-unchanged constraint (baseline Task 1 + per-task desktop diff) ✓.
- **Deviation from spec, documented:** spec said "dot indicator"; the shared `CarouselControls` already renders a scroll-synced **progress bar**, which is equivalent and avoids new dot logic — reused it instead. Testimonial already uses dots/auto-rotate, so it is untouched.
- **CTA targets:** "Book a class" → authed `/portal/book`, guest `/classes` for the **sticky** bar (explicit user choice). Hero primary "Book a class" → guest `/login` (real booking entry) with hero secondary "Explore classes" → `/classes`, so the two hero CTAs are distinct. Documented intentional difference.
- **Type consistency:** `useCarouselScroll()` returns `{ ref, scrollBy, measure, atStart, atEnd, progress }`; Pricing uses `ref`, `scrollBy`, `measure`, `progress` (Task 6) — matches the hook signature in `src/hooks/useCarouselScroll.ts`.
