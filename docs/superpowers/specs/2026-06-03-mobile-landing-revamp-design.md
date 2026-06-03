# Mobile Landing Page Revamp — Design

**Date:** 2026-06-03
**Branch:** `feat/mobile-landing-revamp`
**Scope:** Mobile (`< md`, i.e. `< 768px`) presentation of the public landing page (`/`, `src/pages/index.tsx`).

## Goal

Make the mobile landing page feel impeccable and pro: lead with the message + a clear path to book, keep a persistent Book CTA, and tighten the long scroll. Both fix concrete issues and raise overall quality.

## Hard constraint

**Desktop (`md+`) output must stay visually unchanged.** Every change is additive at the mobile breakpoint or guarded so `md:`/`lg:` classes already in place keep producing the current desktop render. This follows the repo convention in `.llm/conventions.md` ("keep desktop (`md+`) output unchanged when adding mobile classes").

Brand tokens and fonts are unchanged: cream `#fafaf8`, sage `#7A8B7C`, charcoal, terracotta, sand; fonts `font-display` (serif) / `font-body` / `font-script`; primary CTA = sage `rounded-full` pill (`HEADER_SAGE` pattern from `Navigation.tsx`).

The phone↔tablet line is `md` = 768px, consistent with `useIsMobile` (`@/hooks/use-mobile`).

## Audit findings (iPhone 14, 390×844, live `localhost:3000`)

1. **Hero buries the message.** First 844px = three stacked silent videos with small `move`/`refuel`/`connect` script labels. No headline, value prop, or CTA above the fold. The headline lives in a *separate* `bg-white lg:hidden` section below the fold; its subcopy line-breaks badly ("smoothie bowl,work from").
2. **No persistent Book CTA.** "Book Now" exists only inside the hamburger sheet. Nothing tappable to book across a ~12,341px (≈15 screen) page.
3. **Boutique renders a dead empty state** on mobile ("Products will appear here once added in admin") — a ~1700px dead zone.
4. **Carousels** (Classes, Instructors, Testimonials, Pricing) already use native `snap-x snap-mandatory overflow-x-auto` swipe, but expose circular ‹ › buttons that add thumb clutter and no position feedback (no dots).
5. **Inconsistent rhythm.** Mixed `py-16`/`py-20`, oversized hero type.

## Decisions (from brainstorming)

- **Hero direction:** message-first over a compact video triptych (headline + CTAs above a short 3-tile video strip).
- **Sticky CTA primary target:** logged-out → `/classes` (browse first); logged-in → `/portal/book`. Label "Book a class".
- **Carousels:** remove ‹ › buttons on mobile, rely on native swipe + a scroll-synced dot indicator.

---

## Component designs

Each unit is independent and testable on its own. Desktop branches are untouched.

### 1. `Hero.tsx` — mobile hero (message-first)

**Current:** `<section h-screen>` with `flex flex-col lg:grid lg:grid-cols-3` (three stacked video panels on mobile) **plus** a second `<section bg-white lg:hidden>` headline below.

**Change (mobile only; `lg+` grid hero untouched):**
- Replace the mobile portion (`flex-col` stack visible `< lg`) and the separate `lg:hidden` headline section with one cohesive mobile hero block, rendered `lg:hidden`. The existing `hidden lg:grid` desktop hero stays exactly as-is.
- Mobile block, top → bottom:
  1. Headline (`font-display`), reusing the exact current copy: *"We're more than a studio,"* (italic, muted) / *"We're your home away from home"*. Size tuned to fit ~390px without overflow (start `text-4xl`, validate at 360px).
  2. Eyebrow line: `move · refuel · connect` (`font-script` or small caps), brand-accent color.
  3. Compact video triptych strip: the three existing videos (`Move`, `Refuel`/image, `Connect`) as a row of three rounded tiles, ~30svh tall, `object-cover`, `muted loop playsInline`, each with its small label. Keeps the brand identity.
  4. Primary CTA: **Book a class** — sage pill (`HEADER_SAGE`), → `/portal/book` if authed else `/classes`.
  5. Secondary CTA: **Explore classes** — ghost/outline pill → `/classes`.
- Use `100svh`/`min-h-[100svh]` (not `h-screen`/`vh`) for the mobile hero so mobile browser UI chrome doesn't clip the CTAs.
- Fix the subcopy line break ("smoothie bowl,work" → proper spacing) wherever the subcopy is retained.
- Keep the existing `floatAndZoom` keyframe animations; honor `motion-reduce`.
- Lazy/`preload="none"` or `preload="metadata"` for the mobile triptych videos to limit cellular data; first paint should not block on video.

**Depends on:** `cdnUrl`, existing media constants, `next/image`, `next/link`.

### 2. `MobileStickyCTA.tsx` — new component (`md:hidden`)

A fixed bottom action bar for the landing page.

- `position: fixed; bottom: 0`, full width, `md:hidden`, `z` below the nav sheet (`z-40`; nav sheet is `z-[60]`).
- Appears only after the user scrolls past the hero (reuse the rAF-throttled, compare-and-skip scroll pattern from `Navigation.tsx` lines 85–103; threshold ≈ hero height or a fixed `> 600`). Slides up via translate + opacity transition; honors `motion-reduce`.
- Content: primary **Book a class** sage pill (→ `/portal/book` if `useSession()` authed, else `/classes`) + a quieter **Pricing** text link (→ `/pricing`).
- Padding bottom uses `env(safe-area-inset-bottom)`.
- Must not overlap the footer awkwardly and must not appear while the mobile nav sheet is open. Simplest robust approach: hide when `document.body.style.overflow === 'hidden'` is brittle — instead expose hide behavior by listening for scroll only and accept that the nav sheet (`z-[60]`, full-screen `bg-cream`) fully covers it. The sheet covering it is sufficient; no shared state needed.
- Touch target ≥44px height.

**Mounted in:** `src/pages/index.tsx`, after `<Footer />`, once.

**Depends on:** `next/link`, `next-auth/react` `useSession`, `Button`, `cn`.

### 3. Section rhythm (all landing sections)

Normalize mobile vertical padding without changing desktop:
- Standardize the mobile pad to `py-14` while preserving the existing desktop value (e.g. `py-14 md:py-20`, `py-14 md:py-16`). Only the unprefixed (mobile) value changes; the `md:` value stays whatever it is today so `md+` is identical.
- Consistent eyebrow → `h2` → subcopy type scale across sections at the mobile breakpoint (align to the values already used in `Experience.tsx` / `ClassCatalog.tsx`).
- Files: `Experience.tsx`, `ClassCatalog.tsx`, `Instructors.tsx`, `Testimonial.tsx`, `Pricing.tsx`, `Founder.tsx`, `Rental.tsx`, `Boutique.tsx`, `Footer.tsx`. Each change is mobile-value-only.

### 4. Boutique empty-state hide (`Boutique.tsx`)

- When the product list is empty, render `null` (or nothing on the landing page) instead of the "Products will appear here once added in admin" placeholder. Removes the dead zone for all viewports (placeholder has no value to a public visitor). If an admin-only hint is desired it is out of scope here.

### 5. Carousel controls → swipe + dots (mobile)

Applies to `ClassCatalog.tsx`, `Instructors.tsx`, `Testimonial.tsx`, `Pricing.tsx`.

- Native swipe already works (`snap-x snap-mandatory overflow-x-auto`). Keep it.
- Hide the ‹ › circular buttons on mobile (`hidden md:flex` / `md:inline-flex` on the existing button row). Desktop keeps its arrows.
- Add a **dot indicator** below each track on mobile (`md:hidden`): one dot per card/slide, active dot derived from scroll position via a scroll listener on the track (rAF-throttled), `aria-hidden` on dots with an accessible label on the track region. Tapping a dot may `scrollIntoView` the matching card (optional; swipe is primary).
- Keep `scrollbar-hide`. Preserve existing per-card widths and `snap-*` so desktop is unaffected.

### 6. Polish

- Touch targets ≥44px on all mobile CTAs, nav toggles, dots' hit area.
- Preserve existing focus-visible rings (already present in nav/links).
- Honor `prefers-reduced-motion` on new transitions (sticky bar slide, dot transitions, hero strip animations).
- Mobile hero videos: avoid blocking first paint; `preload` conservative.

---

## Out of scope

- Desktop (`md+`) visual changes of any kind.
- Backend, data, API, auth changes.
- New routes or content. (CTA targets use existing routes `/classes`, `/pricing`, `/portal/book`, `/login`.)
- Boutique admin-empty messaging redesign beyond hiding it.
- Non-landing pages.

## Testing / verification

- Re-audit at 390px (iPhone 14) and 360px (small Android) with agent-browser: hero shows headline + both CTAs above the fold; sticky CTA appears after hero and routes correctly for authed vs guest; Boutique section absent when no products; carousels show dots, no arrows, swipe works.
- Verify desktop (`md+`, e.g. 1280px) screenshots are unchanged vs `main` for every touched component (visual diff / side-by-side).
- `npm run lint` clean on touched files.
- Keyboard focus + `prefers-reduced-motion` spot check.

## Risks

- **Desktop regression** is the main risk — mitigated by only editing unprefixed (mobile) classes and the `lg:hidden`/`hidden lg:*` split in the hero, plus desktop visual diff in verification.
- Scroll-synced dots add a listener per carousel; throttle with rAF (pattern already proven in `Navigation.tsx`).
- Sticky bar z-index vs nav sheet — sheet is `z-[60]` full-screen `bg-cream`; bar at `z-40` is fully covered. No shared state required.
