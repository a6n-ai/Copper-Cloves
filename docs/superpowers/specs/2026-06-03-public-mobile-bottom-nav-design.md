# Public Site Mobile Bottom Nav — Design

**Date:** 2026-06-03
**Branch:** `feat/mobile-landing-revamp` (continues the mobile-revamp work)
**Scope:** Mobile (`< md` / `< 768px`) navigation for the **public marketing site** (all `isPublicSite` routes). Make it consistent and familiar with the authenticated dashboard's app-style bottom nav.

## Goal

Replace the public site's mobile hamburger + floating sticky CTA with an app-style **bottom tab bar** that mirrors the dashboard's `MobileBottomNav`: side tabs flanking a **raised center "Book" FAB** (the public analogue of the dashboard's center "Check-in" FAB), a "More" overflow sheet, and a **top-right auth indicator** (avatar when signed in, Login pill when not).

## Hard constraint

**Desktop (`md+`) output stays visually unchanged.** Every change is `md:hidden` (new bottom nav), a mobile-only branch of `Navigation`, or guarded so desktop renders identically. Brand tokens/fonts unchanged: cream `#fafaf8`, sage `#7A8B7C`, terracotta, charcoal, white-warm; `font-display`/`font-body`; primary CTA = sage pill.

## Reference pattern (existing)

`src/components/responsive/MobileBottomNav.tsx` (dashboard, `md:hidden`): fixed bottom bar, `bg-white-warm`, `border-t border-sage/15`, `env(safe-area-inset-bottom)`, side tabs as `flex-1` columns (icon + 10px label), **active = terracotta**, a raised center FAB (`absolute -top-5 h-16 w-16 rounded-full border-4 border-cream bg-terracotta`), and a "More" `Sheet` (`@/components/ui/sheet`, `side="bottom"`) listing overflow sections. The new public component reuses these exact visual conventions (so it feels familiar) but is a **separate, simpler component** with a hardcoded public tab list — it is NOT driven by `PortalConfig` (that type is portal-specific).

## Architecture / mount points

- `_app.tsx` → `PublicChrome` mounts `<Navigation variant={...}>` once for routes in `PUBLIC_NAV_ROUTES`, wrapping page content in a `<div className="min-h-screen bg-cream">`. The new `<PublicMobileNav />` mounts **here**, as a sibling of `<Navigation>`, so it appears on every public page automatically.
- `Navigation.tsx` renders the **top bar** (logo + desktop links/actions + — today — a mobile hamburger). The mobile hamburger toggle and the full-screen mobile sheet are removed; a mobile **auth indicator** (avatar / Login pill) replaces the hamburger on the top-right.

## Decisions (from brainstorming)

- **Tabs:** Home · Classes · [Book FAB] · Pricing · More.
- **Book FAB:** terracotta (`bg-terracotta`), raised circular — matches the dashboard's center FAB exactly. Target: authed → `/portal/book`, guest → `/classes` (browse-first, consistent with the prior sticky-bar decision).
- **Active tab color:** terracotta (matches the dashboard for familiarity).
- **More sheet (catch-all / "last section"):** Café, Instructors, Events, Story, Policy, Terms.
- **Top-right auth:** signed in → avatar circle (initial) opening an account menu (Dashboard, Log out); signed out → "Login" pill.
- **Hamburger:** removed (bottom nav + More + top-right account fully replace it).
- **Visibility:** reveal-on-scroll — hidden over the hero, slides up after scrolling ~60% of the first viewport. Applied uniformly on all public pages via a scroll threshold (`window.scrollY > window.innerHeight * 0.6`).
- **Supersedes:** the `MobileStickyCTA` (built earlier this branch) is removed; the center Book FAB replaces it.

---

## Component designs

### 1. `src/components/PublicMobileNav.tsx` (new, `md:hidden`)

Fixed bottom tab bar for the public site.

- Container: `fixed inset-x-0 bottom-0 z-40 md:hidden border-t border-sage/15 bg-white-warm`, `paddingBottom: env(safe-area-inset-bottom)`. Reveal-on-scroll via `translate-y-full → translate-y-0` with `transition-transform`, `motion-reduce:transition-none`; controlled by the rAF-throttled, compare-and-skip scroll handler (same pattern as `Navigation.tsx` and the removed `MobileStickyCTA`), threshold `window.scrollY > window.innerHeight * 0.6`. `aria-hidden` + `pointer-events-none` while hidden; tab `tabIndex` follows visibility.
- Layout (mirrors dashboard FAB layout):
  ```
  [ Home ][ Classes ]  ( Book FAB )  [ Pricing ][ More ]
  ```
  Left group (`flex-1`): Home, Classes. Center: `w-20 shrink-0` wrapper holding the raised FAB. Right group (`flex-1`): Pricing, More.
- Tab = `Link`, `min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px]`; active (`router.pathname === href` or section match) → `text-terracotta`, else `text-charcoal/55`. Icons (`lucide-react`): Home `Home`, Classes `CalendarDays`, Pricing `Tag` (or `IndianRupee`), More `Menu`.
- **Book FAB:** `button`/`Link`, `absolute -top-5 h-16 w-16 rounded-full border-4 border-cream bg-terracotta text-cream shadow-lg shadow-terracotta/30 active:scale-95`, icon `Ticket` + 9px "Book" label. `href` = authed `/portal/book` else `/classes` (via `useSession`). Matches the dashboard's check-in FAB treatment exactly.
- **More:** opens `Sheet` (`side="bottom"`, `rounded-t-2xl`) listing the overflow links (Café, Instructors, Events, Story) and a divider + Policy, Terms. Each row `min-h-12 flex items-center gap-3` with icon; active row highlighted terracotta. Closes on navigate. (Account/auth is NOT duplicated here — it lives top-right.)
- `useSession` for the Book target only; the bar itself renders for all users.

**Depends on:** `next/link`, `next/router`, `next-auth/react`, `@/components/ui/sheet`, `lucide-react`, `cn`.

### 2. `src/components/Navigation.tsx` — mobile top-right auth (replace hamburger)

- **Remove:** the mobile hamburger `Button` (the `md:hidden` toggle) and the entire full-screen mobile sheet block (`{mobileMenuOpen && (...)}`), plus now-unused `mobileMenuOpen` state and its body-scroll-lock/Escape effect and the route-change close effect if only used by it. Keep `scrolled` logic (used by the overlay bar).
- **Add (mobile, `md:hidden`, top-right):**
  - Signed in: a round avatar button (initial, sage bg — reuse the existing desktop account-button styling) that opens the **same** account `DropdownMenu` already defined for desktop (Dashboard → `dashHref`, Log out → `signOut`). Factor the menu items so desktop and mobile share them (avoid duplication).
  - Signed out: a compact **Login** pill (`Link href="/login"`, sage or ghost per the `onHero` state) — small, `text-sm`.
  - On the hero overlay (`onHero`), use light ink so it stays legible over the dark hero (same approach the desktop nav already uses).
- Desktop (`hidden md:flex`) actions block is unchanged.

### 3. `src/pages/_app.tsx` — mount + global clearance

- In `PublicChrome`, render `<PublicMobileNav />` as a sibling after `<Navigation variant={variant} />` (only when `isPublicSite`). It is `md:hidden`, so desktop is unaffected.
- Add bottom clearance so the fixed bar never hides a page's last content: apply `pb-[76px] md:pb-0` to the public content wrapper (the `min-h-screen bg-cream` div, or a dedicated inner wrapper around `PageTransition`). The cream pad sits behind the opaque bar (invisible) and guarantees the last row scrolls clear. Verify this doesn't shift desktop (it won't — `md:pb-0`).

### 4. `src/pages/index.tsx` + `src/components/Footer.tsx` — remove superseded pieces

- Remove `import { MobileStickyCTA }` and `<MobileStickyCTA />` from `index.tsx`.
- Delete `src/components/MobileStickyCTA.tsx`.
- **Revert** the Footer `pb-20 md:pb-0` change (back to `bg-sage text-cream`) — bottom clearance is now handled globally in `PublicChrome`, so the footer-specific hack is redundant.

---

## Out of scope

- Desktop (`md+`) visual changes.
- Dashboard `MobileBottomNav` (untouched; only referenced for style).
- Auth/session, backend, routes, content (all CTA targets use existing routes: `/`, `/classes`, `/pricing`, `/cafe`, `/instructors`, `/rental` (Events), `/story`, `/policy`, `/terms`, `/portal/book`, `/login`).
- New page sections (the "extra in last section" is the More sheet, not new page content).

## Verification

- agent-browser at 390px + 360px on `/` and at least one inner public page (e.g. `/classes`): bottom bar hidden over hero, reveals on scroll, Home/Classes/Pricing/More tabs + center sage Book FAB; active tab terracotta; More sheet opens with Café/Instructors/Events/Story/Policy/Terms; Book FAB href = `/classes` (guest); no hamburger; top-right shows Login pill (guest) / avatar (authed); last footer row clears the bar.
- Desktop (`md+`, 1280px) on `/` and an inner page: identical to before — no bottom bar, top bar nav unchanged, no top-right regression.
- `npm run lint` clean on touched files. `prefers-reduced-motion` spot check.

## Risks

- **Removing the hamburger sheet** from `Navigation.tsx` touches state/effects — must remove only what's exclusively the sheet's, keeping `scrolled` and overlay logic intact. Mitigate by reading the file and removing surgically; verify desktop + mobile top bar still render.
- **Global bottom padding** in `PublicChrome` affects every public page — verify a couple of inner pages aren't visually broken and desktop is `pb-0`.
- **Reveal threshold** `innerHeight * 0.6` on short inner pages: if a page is barely taller than one viewport the bar may never reveal — acceptable (short pages need no persistent nav), but verify a short page still reaches the bar by scrolling to the bottom.
