# Public Site Mobile Bottom Nav — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the public marketing site an app-style mobile bottom tab bar (Home · Classes · [terracotta Book FAB] · Pricing · More) matching the dashboard's `MobileBottomNav`, move auth state to the top-right of the top bar, and remove the now-redundant mobile hamburger and floating sticky CTA.

**Architecture:** A new `md:hidden` `PublicMobileNav` mounts once in `PublicChrome` (`_app.tsx`) so it shows on every public route; it reveals on scroll (hidden over the hero). `Navigation.tsx` drops its mobile hamburger + full-screen sheet and shows an avatar/Login affordance top-right on mobile. The earlier `MobileStickyCTA` is deleted (the Book FAB replaces it) and bottom clearance moves to a single global `pb-[76px] md:pb-0` in `PublicChrome`.

**Tech Stack:** Next.js 15 (Pages Router), React 18, TypeScript, Tailwind v4, `next-auth/react`, `@/components/ui/sheet` (Radix), `lucide-react`. No unit-test runner in this repo → per-task verification is **agent-browser** visual capture (mobile correctness + desktop-unchanged) + `npm run lint`.

---

## Conventions for every task

- **Dev server** runs at `http://localhost:3000` (`npm run dev:next`). Start it if down.
- **agent-browser** installed (v0.27.1). Mobile = `iPhone 14`; small = viewport `360 800`; desktop = `1280 800`. Screenshots need **absolute** paths; `.audit/` is git-ignored.
- **Commits are GATED**: the repo owner commits manually. Each task ends with a prepared commit command — **do not run it** until the user says so. Do not stage automatically.
- **Hard constraint:** desktop (`md+`) render stays identical (except nothing here should touch desktop at all). The desktop-diff step enforces it.

### Known facts (verified)
- `PublicChrome` in `src/pages/_app.tsx` renders `<div className="min-h-screen bg-cream">{variant && <Navigation variant={variant} />}<PageTransition>{children}</PageTransition></div>` for `isPublicSite` routes.
- Public routes (from `src/lib/isPublicSite.ts` `PUBLIC_NAV_ROUTES`): `/`, `/classes`, `/cafe`, `/shop`, `/shop/[id]`, `/rental` (Events), `/story`, `/instructors`, `/pricing`, `/policy`, `/terms`. All target files exist.
- Tailwind colors in use (dashboard nav): `bg-white-warm`, `bg-terracotta`, `text-terracotta`, `shadow-terracotta/30`, `border-cream`, `text-charcoal/55`, `bg-sage/5`. Sage CTA helper in `Navigation.tsx`: `HEADER_SAGE = "bg-[#7A8B7C] hover:bg-[#6d7c6e] active:bg-[#637069]"`.
- `@/components/ui/sheet` exports `Sheet, SheetContent, SheetHeader, SheetTitle` (among others).
- `src/pages/index.tsx` currently imports and renders `<MobileStickyCTA />` after `<Footer />`.
- `src/components/Footer.tsx` root is `<footer className="bg-sage text-cream pb-20 md:pb-0">` (the `pb-20 md:pb-0` was added earlier and is reverted in Task 4).

---

## Task 1: Create `PublicMobileNav.tsx`

**Files:**
- Create: `src/components/PublicMobileNav.tsx`

The bottom tab bar. Self-contained; does not touch anything else yet (not mounted until Task 2).

- [ ] **Step 1: Create the component**

Create `src/components/PublicMobileNav.tsx` with exactly:
```tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import {
  Home,
  CalendarDays,
  Tag,
  Menu,
  Ticket,
  Coffee,
  Users,
  Sparkles,
  BookOpen,
  Shield,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Tab = { href: string; label: string; icon: LucideIcon };

const TABS_LEFT: Tab[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/classes", label: "Classes", icon: CalendarDays },
];
const TABS_RIGHT: Tab[] = [{ href: "/pricing", label: "Pricing", icon: Tag }];
const MORE_LINKS: Tab[] = [
  { href: "/cafe", label: "Café", icon: Coffee },
  { href: "/instructors", label: "Instructors", icon: Users },
  { href: "/rental", label: "Events", icon: Sparkles },
  { href: "/story", label: "Story", icon: BookOpen },
];
const MORE_LEGAL: Tab[] = [
  { href: "/policy", label: "Policy", icon: Shield },
  { href: "/terms", label: "Terms", icon: FileText },
];

/**
 * App-style bottom tab bar for the public marketing site (`md:hidden`), built
 * to mirror the dashboard's MobileBottomNav: side tabs flanking a raised center
 * "Book" FAB (the public analogue of the dashboard check-in FAB), plus a "More"
 * bottom sheet for overflow. Reveal-on-scroll: hidden over the hero, slides up
 * past ~60% of the first viewport. Mounted once in PublicChrome (_app.tsx).
 */
export function PublicMobileNav() {
  const router = useRouter();
  const { status } = useSession();
  const bookHref = status === "authenticated" ? "/portal/book" : "/classes";
  const [show, setShow] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // rAF-throttled, compare-and-skip (same pattern as Navigation.tsx).
  useEffect(() => {
    let ticking = false;
    let last = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const next = window.scrollY > window.innerHeight * 0.6;
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

  // Close the More sheet on navigation.
  useEffect(() => {
    const close = () => setMoreOpen(false);
    router.events.on("routeChangeComplete", close);
    return () => router.events.off("routeChangeComplete", close);
  }, [router.events]);

  const isActive = (href: string) =>
    href === "/"
      ? router.pathname === "/"
      : router.pathname === href || router.pathname.startsWith(`${href}/`);
  const moreActive = [...MORE_LINKS, ...MORE_LEGAL].some((l) => isActive(l.href));

  const tabCls = (active: boolean) =>
    cn(
      "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-body transition-colors",
      active ? "text-terracotta" : "text-charcoal/55 hover:text-charcoal",
    );

  const renderTab = (tab: Tab) => {
    const Icon = tab.icon;
    return (
      <Link key={tab.href} href={tab.href} tabIndex={show ? 0 : -1} className={tabCls(isActive(tab.href))}>
        <Icon className="h-5 w-5" />
        <span className="max-w-full truncate px-0.5">{tab.label}</span>
      </Link>
    );
  };

  const renderMoreRow = (l: Tab, muted = false) => {
    const Icon = l.icon;
    return (
      <Link
        key={l.href}
        href={l.href}
        onClick={() => setMoreOpen(false)}
        className={cn(
          "flex min-h-12 items-center gap-3 rounded-xl px-3 font-body text-sm transition-colors",
          isActive(l.href)
            ? "bg-terracotta/10 text-terracotta"
            : muted
              ? "text-charcoal/70 hover:bg-sage/5"
              : "text-charcoal hover:bg-sage/5",
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {l.label}
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-hidden={!show}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-sage/15 bg-white-warm md:hidden",
          "transition-transform duration-300 ease-out motion-reduce:transition-none",
          show ? "translate-y-0" : "pointer-events-none translate-y-full",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch">
          <div className="flex flex-1 items-stretch">{TABS_LEFT.map(renderTab)}</div>

          <div className="relative flex w-20 shrink-0 justify-center">
            <Link
              href={bookHref}
              tabIndex={show ? 0 : -1}
              aria-label="Book a class"
              className="absolute -top-5 flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full border-4 border-cream bg-terracotta text-cream shadow-lg shadow-terracotta/30 transition-transform active:scale-95 motion-reduce:transition-none"
            >
              <Ticket className="h-6 w-6" />
              <span className="text-[9px] font-body leading-none">Book</span>
            </Link>
          </div>

          <div className="flex flex-1 items-stretch">
            {TABS_RIGHT.map(renderTab)}
            <button type="button" onClick={() => setMoreOpen(true)} tabIndex={show ? 0 : -1} className={tabCls(moreActive)}>
              <Menu className="h-5 w-5" />
              More
            </button>
          </div>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-2xl md:hidden">
          <SheetHeader>
            <SheetTitle className="font-display text-charcoal">Explore</SheetTitle>
          </SheetHeader>
          <div className="mt-2 grid grid-cols-1 gap-1 pb-[env(safe-area-inset-bottom)]">
            {MORE_LINKS.map((l) => renderMoreRow(l))}
            <div className="my-1 h-px bg-sage/10" />
            {MORE_LEGAL.map((l) => renderMoreRow(l, true))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no NEW errors referencing `PublicMobileNav.tsx` (ignore pre-existing warnings elsewhere). Confirm all imported icons exist in `lucide-react` (Home, CalendarDays, Tag, Menu, Ticket, Coffee, Users, Sparkles, BookOpen, Shield, FileText — all standard).

- [ ] **Step 3: Self-review**

Confirm: named export `PublicMobileNav`; `cn`/`Sheet` import paths correct; JSX balanced; not yet imported anywhere (so no runtime impact until Task 2).

- [ ] **Step 4 (gated): Commit**

```bash
git add src/components/PublicMobileNav.tsx
git commit -m "feat(mobile): public site bottom tab bar component"
```

---

## Task 2: Mount `PublicMobileNav` + global bottom clearance (`_app.tsx`)

**Files:**
- Modify: `src/pages/_app.tsx`

- [ ] **Step 1: Import the component**

In `src/pages/_app.tsx`, add to the imports (near `import { Navigation } from "@/components/Navigation";`):
```tsx
import { PublicMobileNav } from "@/components/PublicMobileNav";
```

- [ ] **Step 2: Mount it + add clearance in `PublicChrome`**

Replace the `PublicChrome` return block:
```tsx
  return (
    <div className="min-h-screen bg-cream">
      {variant && <Navigation variant={variant} />}
      <PageTransition>{children}</PageTransition>
    </div>
  );
```
with:
```tsx
  return (
    <div className="min-h-screen bg-cream pb-[76px] md:pb-0">
      {variant && <Navigation variant={variant} />}
      <PageTransition>{children}</PageTransition>
      <PublicMobileNav />
    </div>
  );
```
(`pb-[76px]` reserves space so a page's last content clears the fixed bar on phones; the cream pad sits behind the opaque bar. `md:pb-0` keeps desktop unchanged. `PublicMobileNav` is `md:hidden`, so desktop renders nothing extra.)

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors in `_app.tsx`.

- [ ] **Step 4: Verify mobile (bar reveals on scroll) on landing**

```bash
cd /Users/lawbringr/IdeaProjects/ikara/Copper-Cloves
D=/Users/lawbringr/IdeaProjects/ikara/Copper-Cloves/.audit
agent-browser set device "iPhone 14" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "window.scrollTo(0,0)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,500))" >/dev/null
agent-browser screenshot "$D/t2-bar-top.png" >/dev/null
agent-browser eval "window.scrollTo(0,1500)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,500))" >/dev/null
agent-browser screenshot "$D/t2-bar-scrolled.png" >/dev/null
echo "book href:"; agent-browser eval "document.querySelector('nav.fixed.bottom-0 a[aria-label=\"Book a class\"]')?.getAttribute('href')"
```
Read both. Expected: `t2-bar-top.png` = no bottom bar over the hero; `t2-bar-scrolled.png` = bottom bar with Home/Classes tabs, raised terracotta **Book** FAB, Pricing/More tabs. Book href = `/classes` (guest).

- [ ] **Step 5: Verify an inner public page (`/classes`)**

```bash
agent-browser open http://localhost:3000/classes >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "window.scrollTo(0,1200)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,500))" >/dev/null
agent-browser screenshot "$D/t2-classes.png" >/dev/null
```
Read it. Expected: same bottom bar appears; the "Classes" tab is active (terracotta).

- [ ] **Step 6: Verify desktop has no bar**

```bash
agent-browser set viewport 1280 800 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "window.scrollTo(0,1500)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,500))" >/dev/null
agent-browser screenshot "$D/t2-desktop.png" >/dev/null
```
Read it. Expected: no bottom bar; layout unchanged.

- [ ] **Step 7 (gated): Commit**

```bash
git add src/pages/_app.tsx
git commit -m "feat(mobile): mount public bottom nav site-wide + bottom clearance"
```

---

## Task 3: Replace mobile hamburger with top-right auth (`Navigation.tsx`)

**Files:**
- Modify: `src/components/Navigation.tsx`

Remove the mobile hamburger toggle + full-screen sheet (the bottom nav + More replace them), and put an auth affordance top-right on mobile: avatar→account menu when signed in, Login pill when not.

- [ ] **Step 1: Remove the mobile toggle button**

Delete this block (the `md:hidden` toggle):
```tsx
          {/* Mobile toggle */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden rounded-full"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
            aria-label="Open menu"
          >
            <Menu size={24} className="text-charcoal" />
          </Button>
```
and replace it with the mobile auth affordance:
```tsx
          {/* Mobile auth (top-right) — navigation lives in the bottom tab bar */}
          <div className="md:hidden">
            {authed ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="flex size-10 items-center justify-center rounded-full bg-[#7A8B7C] font-display text-base text-cream shadow-xs focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#7A8B7C]/40"
                  >
                    {accountInitial}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="truncate font-body">{accountName}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={dashHref} className="cursor-pointer">
                      <LayoutDashboard size={16} className="mr-2" /> Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/portal/book" className="cursor-pointer">
                      <Ticket size={16} className="mr-2" /> Book a class
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="cursor-pointer text-terracotta focus:text-terracotta"
                  >
                    <LogOut size={16} className="mr-2" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button
                  className={cn(
                    "h-auto gap-1.5 rounded-full border-0 px-5 py-2 text-sm font-body font-medium text-cream shadow-xs",
                    HEADER_SAGE,
                  )}
                >
                  <LogIn size={16} /> Login
                </Button>
              </Link>
            )}
          </div>
```

- [ ] **Step 2: Remove the full-screen mobile sheet**

Delete the entire block that starts with the comment `{/* Mobile full-screen sheet — centered Playfair links (DESIGN.md nav spec) */}` and is wrapped in `{mobileMenuOpen && ( ... )}` — i.e. everything from:
```tsx
      {/* Mobile full-screen sheet — centered Playfair links (DESIGN.md nav spec) */}
      {mobileMenuOpen && (
```
through its closing:
```tsx
        </div>
      )}
    </nav>
  );
}
```
Keep the final `</nav>`, `);` and `}` that close the component — only the `{mobileMenuOpen && ( ... )}` sheet `<div>...</div>` is removed. After this edit the component ends:
```tsx
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Remove now-dead state + effects**

- Delete the state line: `const [mobileMenuOpen, setMobileMenuOpen] = useState(false);`
- Delete the route-change close effect (only used by the sheet):
```tsx
  useEffect(() => {
    const close = () => setMobileMenuOpen(false);
    router.events.on("routeChangeComplete", close);
    return () => router.events.off("routeChangeComplete", close);
  }, [router.events]);
```
- Delete the body-scroll-lock + Escape effect (only used by the sheet):
```tsx
  // Lock body scroll + close on Escape while the full-screen mobile sheet is open.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileMenuOpen]);
```
Keep the `scrolled` effect (used by the overlay bar) and the `useState`/`useEffect` imports (still used by `scrolled`).

- [ ] **Step 4: Drop now-unused icon imports**

In the lucide import line `import { Menu, X, LogIn, Ticket, LayoutDashboard, LogOut } from "lucide-react";`, remove `Menu` and `X` (no longer used). Result:
```tsx
import { LogIn, Ticket, LayoutDashboard, LogOut } from "lucide-react";
```
(Keep `LogIn`, `Ticket`, `LayoutDashboard`, `LogOut` — all still used.)

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no NEW errors in `Navigation.tsx`; specifically no "Menu/X is defined but never used", no "mobileMenuOpen is not defined", no unused-var for removed state.

- [ ] **Step 6: Self-review**

Confirm: the only `md:hidden` element in the top bar is now the auth affordance; the sheet block and its state/effects are gone; `authed`, `accountInitial`, `accountName`, `dashHref`, `HEADER_SAGE`, `cn` are all still in scope (defined earlier in the component); desktop `hidden md:flex` actions block is untouched.

- [ ] **Step 7: Verify mobile top-right + desktop unchanged**

```bash
cd /Users/lawbringr/IdeaProjects/ikara/Copper-Cloves
D=/Users/lawbringr/IdeaProjects/ikara/Copper-Cloves/.audit
agent-browser set device "iPhone 14" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "window.scrollTo(0,0)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,500))" >/dev/null
agent-browser screenshot "$D/t3-topbar-guest.png" >/dev/null
agent-browser set viewport 1280 800 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "window.scrollTo(0,1500)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,500))" >/dev/null
agent-browser screenshot "$D/t3-desktop.png" >/dev/null
```
Read both. Expected: mobile top bar shows logo + a **Login** pill top-right (no hamburger); desktop nav (links + Book Now + Login) unchanged. (Authed avatar state is verified manually if a test login is available; otherwise the guest path proves the branch renders.)

- [ ] **Step 8 (gated): Commit**

```bash
git add src/components/Navigation.tsx
git commit -m "feat(mobile): top-right auth on nav, remove hamburger + full-screen sheet"
```

---

## Task 4: Remove the superseded sticky CTA + revert Footer hack

**Files:**
- Modify: `src/pages/index.tsx`
- Delete: `src/components/MobileStickyCTA.tsx`
- Modify: `src/components/Footer.tsx`

- [ ] **Step 1: Unmount + un-import `MobileStickyCTA` in `index.tsx`**

Remove the import line:
```tsx
import { MobileStickyCTA } from "@/components/MobileStickyCTA";
```
Remove the render line so the tail is:
```tsx
        <Boutique />
        <Footer />
      </div>
```

- [ ] **Step 2: Delete the component file**

Run: `rm src/components/MobileStickyCTA.tsx`

- [ ] **Step 3: Revert the Footer bottom-padding hack**

In `src/components/Footer.tsx`, change:
```tsx
    <footer className="bg-sage text-cream pb-20 md:pb-0">
```
back to:
```tsx
    <footer className="bg-sage text-cream">
```
(Bottom clearance is now handled globally by `pb-[76px] md:pb-0` in `PublicChrome` from Task 2.)

- [ ] **Step 4: Lint + dead-reference check**

Run: `npm run lint`
Run: `rg -n "MobileStickyCTA" src` — Expected: **no matches** (no dangling import/reference anywhere).
Expected lint: no new errors.

- [ ] **Step 5: Verify landing bottom clears the bar (mobile)**

```bash
cd /Users/lawbringr/IdeaProjects/ikara/Copper-Cloves
D=/Users/lawbringr/IdeaProjects/ikara/Copper-Cloves/.audit
agent-browser set device "iPhone 14" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "window.scrollTo(0,99999)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,900))" >/dev/null
agent-browser eval "window.scrollTo(0,99999)" >/dev/null
agent-browser eval "new Promise(r=>setTimeout(r,500))" >/dev/null
agent-browser screenshot "$D/t4-bottom.png" >/dev/null
```
Read it. Expected: only ONE bottom bar (the tab bar — no leftover sticky CTA); the footer's last row (copyright / Privacy / Terms) is fully visible above the tab bar.

- [ ] **Step 6 (gated): Commit**

```bash
git add src/pages/index.tsx src/components/Footer.tsx
git rm src/components/MobileStickyCTA.tsx
git commit -m "refactor(mobile): drop sticky CTA (superseded by Book FAB), revert footer pad"
```

---

## Task 5: Final audit — mobile sweep + desktop regression

**Files:** none modified (verification only).

- [ ] **Step 1: Full mobile sweep at 390px (landing)**

```bash
cd /Users/lawbringr/IdeaProjects/ikara/Copper-Cloves
F=/Users/lawbringr/IdeaProjects/ikara/Copper-Cloves/.audit/nav-final
rm -rf "$F" && mkdir -p "$F"
agent-browser set device "iPhone 14" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
H=$(agent-browser eval "document.body.scrollHeight" | tail -1 | tr -dc 0-9)
n=0; y=0
while [ "$y" -lt "$H" ]; do
  agent-browser eval "window.scrollTo(0,$y)" >/dev/null
  agent-browser eval "new Promise(r=>setTimeout(r,300))" >/dev/null
  agent-browser screenshot "$F/m$(printf '%02d' $n).png" >/dev/null
  n=$((n+1)); y=$((y+780))
done
echo "frames=$n"
```
Read the frames. Checklist: bar hidden over hero, reveals on scroll; tabs Home/Classes/Pricing/More + center terracotta Book FAB; active tab terracotta; no hamburger; top-right Login pill; last footer row clears the bar.

- [ ] **Step 2: More sheet + small-phone pass**

- Tap "More" (`agent-browser find text "More" click` after scrolling so the bar is visible) and screenshot: expect a bottom sheet with Café, Instructors, Events, Story, divider, Policy, Terms.
- Repeat key checks at `agent-browser set viewport 360 800`: no horizontal overflow; FAB centered; tap targets ≥44px.

- [ ] **Step 3: Inner-page + active-state check**

Load `/pricing` and `/cafe`; scroll to reveal the bar. Expect: on `/pricing` the Pricing tab is terracotta-active; on `/cafe` the More tab is active (Café lives under More).

- [ ] **Step 4: Desktop regression at 1280px**

```bash
agent-browser set viewport 1280 800 >/dev/null
for p in "" classes pricing cafe; do
  agent-browser open "http://localhost:3000/$p" >/dev/null
  agent-browser wait --load networkidle >/dev/null
  agent-browser eval "window.scrollTo(0,1200)" >/dev/null
  agent-browser eval "new Promise(r=>setTimeout(r,400))" >/dev/null
  agent-browser screenshot "$F/desktop-${p:-home}.png" >/dev/null
done
```
Read them. Expected: NO bottom bar on any desktop page; top nav unchanged; no layout shift from the `md:pb-0` clearance.

- [ ] **Step 5: Reduced-motion + final lint**

- Emulate reduced motion (`agent-browser set media reduced-motion` if available), reload, confirm the bar appears without the slide transition.
- Run `npm run lint`; expect clean on all touched files.

- [ ] **Step 6: Finish**

Use `superpowers:finishing-a-development-branch` to decide integration. Commits remain gated on the user's explicit request.

---

## Self-review notes (author)

- **Spec coverage:** `PublicMobileNav` component (Task 1) ✓; mounted site-wide in PublicChrome + clearance (Task 2) ✓; tabs Home/Classes/[Book]/Pricing/More with terracotta FAB + active, More sheet catch-all (Task 1) ✓; reveal-on-scroll threshold `innerHeight*0.6` (Task 1) ✓; Navigation top-right auth + hamburger/sheet removal (Task 3) ✓; remove MobileStickyCTA + revert Footer + global clearance (Tasks 2,4) ✓; verification incl. inner pages + desktop (Tasks 2,5) ✓.
- **Book FAB target:** authed `/portal/book`, guest `/classes` — consistent across the FAB and the removed sticky bar's decision. Active color + FAB both terracotta (dashboard match).
- **Type consistency:** `Tab = { href, label, icon: LucideIcon }` used uniformly; `renderTab`/`renderMoreRow` consume it; `isActive`/`moreActive` defined once. `bookHref` derived from `useSession().status`.
- **Routes verified:** all tab/More hrefs (`/`, `/classes`, `/pricing`, `/cafe`, `/instructors`, `/rental`, `/story`, `/policy`, `/terms`, `/portal/book`, `/login`) exist.
- **Desktop safety:** every new element is `md:hidden`; `_app` clearance is `md:pb-0`; Navigation desktop block untouched; removed sheet was `md:hidden`. No desktop change expected anywhere.
