# Design Fix Plan

Audit date: 2026-05-28
Source: impeccable audit — full site review
Status key: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Critical — Absolute ban violations

### 1. Experience section: Identical card grid [x]
- **File:** `src/components/Experience.tsx`
- **Issue:** Three white cards, each with a large Lucide icon (Dumbbell, Coffee, Users) above a heading above body text. Same size, same background, same radius. Identical card grid + icon-above-heading = double ban.
- **Fix:** Replace with an asymmetric editorial layout. Options: full-width image-backed row for each pillar, a single large typographic block with smaller image insets, or a horizontal strip with image left + text right alternating. No icon grids.
- **Acceptance:** No identical card repeated more than once. No Lucide icon as the primary visual anchor above a heading.

### 2. Rental section: Glassmorphism floating badge [x]
- **File:** `src/components/Rental.tsx`
- **Issue:** Floating "Up to 40 Guests" badge inside hero image uses `bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl` — decorative glassmorphism. Also: features below the image repeat the icon+heading+text grid (Calendar, Users, Sparkles).
- **Fix:** Replace the floating badge with a solid white-warm panel (`bg-[#fafaf8]`) with warm border, no blur. Restructure the three features as a text list or a split layout, not a card grid.
- **Acceptance:** No `backdrop-blur` on the badge. No icon card grid below the image.

### 3. Pricing + Boutique: Decorative blur blobs [x]
- **Files:** `src/components/Pricing.tsx` (lines 186-188), `src/components/Boutique.tsx` (lines 57-58)
- **Issue:** Each section independently drops two `rounded-full blur-3xl` blobs as background "texture." Same visual move used on 3+ consecutive sections — signals template, not design.
- **Fix:** Remove the blob divs entirely. Use tonal background color shifts between sections (cream → sand → cream) to create separation without decoration. If a section needs visual energy, use photography or the typography itself.
- **Acceptance:** Zero `rounded-full blur-3xl` decorative elements anywhere in public pages.

---

## High impact

### 4. Testimonials: All 5-star ratings [x]
- **File:** `src/components/Testimonial.tsx`
- **Issue:** All 6 testimonials hard-coded as 5/5 stars. Uniform perfect ratings signal fabrication to any discerning visitor and undermine the warm/authentic brand.
- **Fix:** Either (a) remove the star rating display entirely and let the quote speak, or (b) use realistic ratings (4–5 stars with at least one 4-star). Option (a) is cleaner and more authentic-feeling.
- **Acceptance:** No uniform all-5-star display.

### 5. Landing page: Identical section header structure [x]
- **Files:** `Experience.tsx`, `Pricing.tsx`, `Rental.tsx`, `Boutique.tsx`, `Testimonial.tsx`
- **Issue:** Every section uses the same pattern: centered display heading 5-6xl + charcoal + paragraph subtext below. Zero variation in alignment, scale, or structure across the entire scroll.
- **Fix:** Break the pattern on at least 3 sections. Examples: make Rental heading left-aligned and oversized (7xl), make Testimonial heading italic-only with no subtext, make Boutique heading right-aligned, give Pricing a tight heading with a small descriptor label above it instead of a full paragraph below.
- **Acceptance:** At least 3 section headers have distinct alignment or scale treatment from the centered-display default.

---

## Medium impact

### 6. Portal milestones: Off-brand colors [x]
- **File:** `src/pages/portal/dashboard.tsx` (lines ~70-82)
- **Issue:** Alchemist milestone uses `text-amber-600 bg-amber-50 border-amber-200`; Immortal uses `text-yellow-600 bg-yellow-50 border-yellow-200`. These Tailwind amber/yellow tokens are completely outside the brand palette.
- **Fix:** Map both to brand palette:
  - Alchemist: `text-terracotta bg-terracotta/10 border-terracotta/20`
  - Immortal: use a richer terracotta (`text-[#a05e38]`) or a deep sand tone
- **Acceptance:** No `amber-*` or `yellow-*` Tailwind utilities in milestone definitions.

### 7. Globals: Bricolage Grotesque unused import [x]
- **File:** `src/app/globals.css` (line 1)
- **Issue:** `family=Bricolage+Grotesque:wght@200;300;400;500;600;700;800` in the Google Fonts URL. Never assigned to any CSS variable or Tailwind utility. Costs ~25KB per page load for zero visual return.
- **Fix:** Remove `Bricolage+Grotesque:wght@200;300;400;500;600;700;800&` from the import URL.
- **Acceptance:** Bricolage Grotesque absent from all CSS/HTML after fix.

### 8. Globals: Sidebar CSS variables duplicated 3× [x]
- **File:** `src/app/globals.css` (lines 183-202, 279-287, 291-299)
- **Issue:** `--sidebar-*` variables defined three separate times, mixing HSL triplet and `hsl()` expression formats. Triple definition for the same set of tokens.
- **Fix:** Keep one canonical block in the `@layer base :root` at lines 183-202. Remove the duplicate raw-value blocks at 279-287 and 291-299. Verify sidebar still renders correctly.
- **Acceptance:** `--sidebar-background` (and all sidebar tokens) defined once only in globals.css.

### 9. Globals: No prefers-reduced-motion guard [x]
- **File:** `src/app/globals.css`
- **Issue:** `animateFloatAndZoom17` and `animateFloatAndZoom19` keyframes run continuously on hero video backgrounds. Hero crossfades use `transition-opacity duration-2000`. No `@media (prefers-reduced-motion: reduce)` guard anywhere.
- **Fix:** Add to globals.css:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .animate-floatAndZoom17,
    .animate-floatAndZoom19 {
      animation: none;
    }
    .transition-opacity {
      transition-duration: 0ms;
    }
  }
  ```
- **Acceptance:** `@media (prefers-reduced-motion: reduce)` block present and disabling the float/zoom animations.

---

---

# Round 2 — full-site audit (2026-05-31)

Round 1 covered the public landing components + globals + portal dashboard milestones. Round 2 sweeps every other surface: auth flow, member portal, admin, partner/instructor portals, remaining public pages. New findings continue the numbering (10+).

## Critical — Absolute ban violations

### 10. Auth shell: glassmorphism on every login page [x]
- **File:** `src/components/auth/AuthShell.tsx` (line 48)
- **Issue:** The shared card wrapping ALL sign-in/sign-up/reset forms uses `backdrop-blur-3xl backdrop-saturate-150` over a `from-white/80 to-white/60` gradient with `border-white/50`, `ring-white/50`, and a custom inset white-highlight shadow `shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.7),...]`. Decorative glassmorphism + pure-white surfaces, on the highest-trust screen in the product. Every portal entry inherits it.
- **Fix:** Drop the blur and the white gradient. Use a solid `bg-white-warm` (`#fafaf8`) card with `border border-[#e5e4dc]` (warm border) and the system Lifted shadow (`0 4px 24px rgba(51,51,51,0.08)`) only. No `backdrop-blur`, no `ring-white`, no inset white highlight.
- **Acceptance:** No `backdrop-blur*` or `white/NN` opacity surfaces in AuthShell; card sits on cream with warm border.

### 11. Blue status badges (outright blue ban) [x]
- **Files:** `src/pages/instructor/dashboard.tsx:86` (`text-blue-700 bg-blue-50 border-blue-200` "Upcoming"), `src/components/admin/DayScheduleList.tsx:39` (`text-blue-700 bg-blue-50` "started"), `src/pages/admin/products.tsx:421` (`bg-blue-100 text-blue-800` "processing"), `src/pages/admin/CRM.tsx:554` (`text-blue-600` "scheduled").
- **Issue:** Blue is the SaaS-default the brand explicitly rejects. It appears as a status color in four places. No blue belongs on any surface.
- **Fix:** Remap to brand: informational/upcoming → `sage` tones; scheduled → `terracotta` or sand. Fold into the shared status-tone map (see #13).
- **Acceptance:** Zero `blue-*` Tailwind utilities anywhere in the app.

### 12. blur-3xl decorative blobs beyond Pricing/Boutique [x]
- **Files:** `src/components/Instructors.tsx:272-273`, `src/components/ClassCatalog.tsx:99`, `src/pages/shop.tsx:259-260`, `src/pages/admin/dashboard.tsx:1206-1207`.
- **Issue:** Round 1 (#3) only removed blobs from Pricing + Boutique. The same `rounded-full blur-3xl` background-texture move survives on four more surfaces, including the admin dashboard. Confirms the template smell #3 called out.
- **Fix:** Remove the blob divs. Use tonal background shifts (cream → sand) or photography. Same rule as #3, now applied site-wide.
- **Acceptance:** Zero `rounded-full blur-3xl` decorative elements anywhere in `src/` (extends #3 acceptance to the whole codebase).

---

## High impact

### 13. Status-badge colors are off-palette and ad-hoc (SYSTEMIC) [x]
- **Files:** `src/pages/portal/packages.tsx:834-836,906-908` (`green-100`/`gray-100`/`yellow-100`), `src/pages/portal/bookings.tsx:86` (`amber-100`), `src/pages/portal/book.tsx:1611` (`amber-50`), `src/pages/admin/products.tsx:420-422` (`yellow`/`blue`/`purple`), `src/pages/admin/credits.tsx:216,220` (`red-500`/`amber-500`), `src/pages/admin/CRM.tsx:549,553,554` (`green`/`red`/`blue`), `src/pages/partner/classes.tsx:364,372` (`red`), `src/components/admin/DayScheduleList.tsx:39,43,45` (`blue`/`red`), `src/pages/instructor/dashboard.tsx:86,372` (`blue`/`red`).
- **Issue:** Every status badge invents its own raw-Tailwind palette. Eight+ files, no shared abstraction. This is one missing token, not ten bugs. Several use banned blue (#11); the rest drift to amber/yellow/green/purple/gray that the brand forbids.
- **Fix:** Add one shared helper, e.g. `statusTone(state)` in `src/lib/` (or a `<StatusBadge>` component) returning brand classes: success/active → `bg-sage/10 text-sage`; pending/awaiting → `bg-terracotta/10 text-terracotta`; expired/inactive → `bg-charcoal/10 text-charcoal/60`; error/failed → `bg-[#a05e38]/10 text-[#a05e38]` (deep terracotta). Point every call site at it.
- **Acceptance:** No `green-*`/`yellow-*`/`amber-*`/`blue-*`/`purple-*`/`gray-*` Tailwind utilities in status/badge code; all route through one map.

### 14. MetricCard ships a hardcoded amber tone (shared admin component) [x]
- **File:** `src/components/admin/MetricCard.tsx:40-44` (and `tone` union line 16); consumed by `admin/dashboard.tsx`, `admin/credits.tsx`, `admin/members.tsx`.
- **Issue:** The reusable metric card offers a `tone="amber"` variant wired to `bg-amber-100 text-amber-600 ring-amber-200 ...` — raw Tailwind amber baked into a shared primitive, so every consumer that picks `amber` inherits an off-brand color. Round 1 #6 fixed amber only in the portal dashboard; the admin component still propagates it.
- **Fix:** Replace the `amber` tone's classes with a brand warm tone (terracotta-family: `bg-terracotta/10 text-terracotta ring-terracotta/20 group-hover:...`), or rename the tone to `terracotta` and update call sites. No Tailwind `amber-*` in the component.
- **Acceptance:** `MetricCard.tsx` contains no `amber-*`/`yellow-*` utilities.

### 15. Pure-white surfaces across portals and utility pages [x]
- **Files:** `src/pages/partner/dashboard.tsx:96`, `src/pages/partner/members.tsx:92`, `src/pages/partner/settings.tsx:135` (`bg-white/95`); `src/pages/portal/book.tsx:1434,1462,1501` (`bg-white` radio indicators); `src/pages/cafe.tsx:72` (`rgb(255,255,255)`); `src/components/responsive/ResponsiveTable.tsx:10` (`from-white/80` fade); `src/pages/404.tsx:17` (`bg-gray-100`).
- **Issue:** The No-Pure-White rule is broken in scattered spots. Partner portal cards are literally white; the 404 page is Tailwind gray, fully outside the palette.
- **Fix:** `bg-white*` → `bg-white-warm` (`#fafaf8`); the cafe `rgb(255,255,255)` → `#fafaf8`; ResponsiveTable fade → `from-[#fafaf8]/90`; 404 → cream bg + charcoal text (see #18).
- **Acceptance:** No `bg-white`, `white/NN`, `rgb(255,255,255)`, or `gray-*` background/text on these surfaces.

---

## Medium impact

### 16. Decorative backdrop-blur sprawl (30+ instances) [x]
- **Files (representative):** `src/components/Navigation.tsx:61,67-68,143` (frosted nav), `src/pages/admin/members.tsx:153,166`, `src/pages/admin/products.tsx:470-509`, `src/pages/admin/control.tsx`, `src/pages/portal/book.tsx:127,230,272,1094,1205`, `src/pages/cafe.tsx:280`, `src/pages/shop.tsx:370`, `src/pages/classes.tsx:484`, `src/pages/founder.tsx:171`, `src/components/ClassCatalog.tsx:118,164`, `src/components/Instructors.tsx:329,341,471`.
- **Issue:** `backdrop-blur-{xs,md,lg,xl,2xl}` used as default card/overlay decoration throughout. Glassmorphism-as-default is banned. (Nuance: the sticky `Navigation` frosted bar is the one arguably-purposeful case — a translucent nav over scrolling content. Decide deliberately: keep it as the single sanctioned exception, or make it solid `bg-cream`. Everything else should lose the blur.)
- **Fix:** Remove `backdrop-blur*` from cards and badges; replace with solid `bg-white-warm` + warm border. Keep blur (if at all) only on true modal scrims and the nav, as an explicit choice.
- **Acceptance:** `backdrop-blur*` count drops to ≤2 deliberate uses (nav + modal scrim), documented as intentional.

### 17. shadow-2xl on resting (non-interactive) surfaces [x]
- **Files:** `src/components/Footer.tsx:183` (map iframe), `src/pages/founder.tsx:99` (image), `src/pages/shop/[id].tsx:249` (product image), `src/pages/portal/book.tsx:1225` (panel).
- **Issue:** Flat-by-default rule: shadow is earned by hover/elevation, not applied at rest. These four apply `shadow-2xl` statically.
- **Fix:** Drop to the system Deep shadow (`0 8px 48px rgba(51,51,51,0.14)`) only for hero/full-bleed images; the book panel and map should use Lifted (`0 4px 24px rgba(51,51,51,0.08)`) or border-only.
- **Acceptance:** No `shadow-2xl` on resting cards/panels; full-bleed images use the Deep token.

### 18. 404 page is fully off-palette [x]
- **File:** `src/pages/404.tsx:17-20`
- **Issue:** `bg-gray-100`, `text-gray-900`, `text-gray-600` — generic Tailwind gray, zero brand. A real (if rare) member touchpoint that looks like an unstyled default.
- **Fix:** `bg-gray-100` → `bg-cream`; `text-gray-900` → `text-charcoal`; `text-gray-600` → `text-[#6b6b6b]` (muted-text). Set the 404 heading in Playfair Display to match brand voice.
- **Acceptance:** No `gray-*` utilities; page reads as branded.

### 19. Onboarding screen: filter hack + glass + pure white [x]
- **File:** `src/pages/portal/onboarding.tsx:224,249,234-235,309,429`
- **Issue:** `style={{ filter: "brightness(0)" }}` to recolor an asset (line 224); `backdrop-blur-xl shadow-2xl` card (line 249); multiple `text-white` (pure white). First-run flow should be exemplary, not hacky.
- **Fix:** Recolor the asset properly (SVG `currentColor`/mask, or a correctly-tinted source) instead of `brightness(0)`. Card → `bg-white-warm` + warm border, no blur, Lifted shadow. `text-white` → `text-white-warm`.
- **Acceptance:** No `filter: brightness(0)`, no `backdrop-blur`, no `text-white` in onboarding.

### 20. Admin cafe: inline keyframe RGB reds/oranges [x]
- **File:** `src/pages/admin/cafe.tsx:681-727` (inline `<style>` block)
- **Issue:** Hardcoded `rgb(220,38,38)` / `rgb(249,115,22)` / `rgb(239,68,68)` (Tailwind red/orange) inside an inline keyframe block for an attention pulse. Off-palette and inline.
- **Fix:** Drive the pulse with terracotta (`#c17856`) / deep-terracotta (`#a05e38`). Move keyframes into the Tailwind/globals layer rather than an inline `<style>`.
- **Acceptance:** No raw red/orange RGB in cafe; animation uses brand hues from a stylesheet.

---

## Low / intentional (document the decision)

### 21. Instructors social-share buttons use real brand hex [x]
- **File:** `src/components/Instructors.tsx:518-521`
- **Issue:** `bg-[#1877F2]` (Facebook), `bg-[#1DA1F2]` (Twitter), `bg-[#0A66C2]` (LinkedIn), `bg-[#25D366]` (WhatsApp) — off-palette, but these are the platforms' official brand colors.
- **Decision needed:** Either (a) accept as a sanctioned exception (recognizable social colors aid scanability) and add a code comment marking it intentional, or (b) neutralize to charcoal/sage icon buttons for full brand consistency. Recommend (b) for a warm-register studio site; the colored chips read as borrowed.
- **Acceptance:** Decision recorded; if (b), no social brand hex remains.

> Note on hero overlays: `Hero.tsx:52,86,103` and a few image overlays use `from-black/50`. DESIGN.md's Video Hero spec explicitly sanctions `from-black/50`, so this is allowed. For strict consistency you may switch to `charcoal`-alpha (`rgba(51,51,51,...)`), but it is P3 at most. Not tracked as a fix.

---

## Implementation order

Recommended sequence to minimize merge complexity:

1. `#7` Bricolage import (1-line removal, zero risk)
2. `#8` Sidebar CSS dedup (globals cleanup, zero visual impact)
3. `#9` prefers-reduced-motion guard (additive, zero risk)
4. `#3` Remove blur blobs from Pricing + Boutique (safe removal)
5. `#6` Portal milestone colors (isolated to one file)
6. `#4` Testimonial stars (data change only)
7. `#2` Rental glassmorphism badge + feature grid (component refactor)
8. `#1` Experience section redesign (largest lift — new layout)
9. `#5` Landing section header variation (cross-component rhythm pass)

---

## Progress summary

| # | Title | Status |
|---|---|---|
| 1 | Experience: identical card grid | [x] |
| 2 | Rental: glassmorphism badge | [x] |
| 3 | Pricing/Boutique: blur blobs | [x] |
| 4 | Testimonials: all 5 stars | [x] |
| 5 | Section headers: zero variation | [x] |
| 6 | Portal milestones: amber/yellow | [x] |
| 7 | Bricolage unused import | [x] |
| 8 | Sidebar CSS vars duplicated | [x] |
| 9 | prefers-reduced-motion guard | [x] |
| 10 | Auth shell glassmorphism (all logins) | [x] |
| 11 | Blue status badges (blue ban) | [x] |
| 12 | blur-3xl blobs beyond Pricing/Boutique | [x] |
| 13 | Status-badge colors off-palette (systemic) | [x] |
| 14 | MetricCard hardcoded amber tone | [x] |
| 15 | Pure-white surfaces across portals + 404 | [x] |
| 16 | Decorative backdrop-blur sprawl (30+) | [x] |
| 17 | shadow-2xl on resting surfaces | [x] |
| 18 | 404 page off-palette gray | [x] |
| 19 | Onboarding filter hack + glass + white | [x] |
| 20 | Admin cafe inline RGB reds/oranges | [x] |
| 21 | Instructors social-share brand hex | [x] |

### Round 2 implementation notes (2026-05-31)

- **#13** introduced `src/lib/statusTone.ts` — `statusTone(intent)` / `statusIntent(state)` / `statusToneFor(state)`. All status pills across portals + admin now route through it (4 intents: success=sage, pending=terracotta, neutral=muted charcoal, error=deep terracotta `#a05e38`). New status UI should import this, never raw Tailwind colors.
- **#11** blue is now zero across live UI (instructor dashboard, DayScheduleList, products, CRM, kitchen). Only remaining `blue-*` live in unused `src/components/shadcn-space/blocks/*` vendor demo scaffolding (not imported by any route) — delete those blocks or ignore.
- **#14** the `amber` tone on `MetricCard` was remapped to deep terracotta but the prop name `"amber"` was kept so call sites compile unchanged.
- **#16 (partial `[~]`)** decorative frosted cards/badges across marketing + admin were made solid (`97 → 2` blurs in the targeted set). Intentionally **kept**: the sticky frosted `Navigation` bar (sanctioned over-content nav), modal/sheet scrims, `components/ui/*` primitives, mobile nav, and two hero CTA outline buttons over the café video (legibility over moving footage). Full elimination to "≤2" sitewide needs visual iteration (`/impeccable live` or `quieter`) since the remaining uses are deliberate.
- Occupancy/heat bars (DayScheduleList, instructor CapacityBar) were remapped sage → terracotta → deep-terracotta so the low/med/high signal survives on-palette.
- Verified: `tsc --noEmit` adds no new type errors (pre-existing errors only, in seed scripts / phone-input / zod schema / razorpay — unrelated).

### Round 1 implementation notes (2026-05-31, same session as Round 2)

- **#1** Experience rebuilt as an asymmetric editorial layout (12-col 7/5 split + a full-width horizontal block), anchored by serif numerals 01/02/03 instead of Lucide icons. No identical card grid, no pure white, on-brand tints (sand / sage / terracotta).
- **#2** Rental glassmorphism badge was already solidified in Round 2; the right-side features are a vertical split-list (not an icon grid). Remaining `shadow-2xl` on the image + badge swapped to Deep / Lifted tokens.
- **#3** Extended beyond Pricing/Boutique: removed every `rounded-full blur-3xl` blob site-wide (Testimonial, classes CTA, admin/control, admin/instructors/[id], admin/schedule/[id]); pure-white gradient `via-white` fills swapped to `via-[#fafaf8]`.
- **#4** Testimonial star rating removed entirely (the authentic option); dropped the fabricated "5.0 Rating" header and the unused `Star` import.
- **#5** Three headers now break the centered default: Experience (left + kicker), Pricing (kicker label above a tight heading, no paragraph), Boutique (right-aligned). Rental + Testimonial stay centered for variety.
- **#6** Milestone tiers rebranded to a warm progression: seeker=sage, warrior=terracotta, alchemist=deep terracotta `#a05e38`, immortal=bronze `#7a4327` (fits the Copper & Clay north star; keeps 4 tiers distinguishable on-palette).
- **#7** Already resolved in current code: fonts load via `next/font/google` (Playfair + Montserrat) in `_app.tsx`; no Bricolage import anywhere. The doc referenced a stale `src/app/globals.css` that does not exist (real path is `src/styles/globals.css`).
- **#8** The sidebar dup was a two-system `@theme` collision from a second shadcn init (the `---break---` blocks). System B used raw `var(--sidebar-foreground)` without the `hsl()` wrapper that DashboardShell's triplet `SIDEBAR_THEME` depends on, silently breaking the intended sage sidebar. Removed System B; System A is now the single source and DashboardShell's sage theme works again.
- **#9** Added a global `@media (prefers-reduced-motion: reduce)` reset in `src/styles/globals.css` (Hero's float/zoom keyframes are component-scoped, so a blanket reset is the reliable fix; framer-motion self-respects the preference too).

### Round 3 — exhaustive palette sweep (2026-05-31)

Beyond the enumerated audit items, swept ALL remaining off-palette color
utilities in live code to zero (was 101).

- red → deep terracotta `#a05e38` (error/destructive); amber/yellow → terracotta
  (warning/pending); green → sage (success); orange → terracotta.
- Heat/occupancy tiers keep their two-level signal (moderate=terracotta, high=deep terracotta).
- TodayClassesCarousel "live" highlight: amber gradient + amber rgba shadow → solid terracotta.
- Instructors philosophy callout: `border-l-4` side-stripe → full border (absolute-ban fix).
- Files: auth forms, admin dashboard/control/schedule/members/partners/instructors,
  all dashboard-tabs, checkin components, portal onboarding/dashboard, shop.
- Verified: 0 off-palette utilities + 0 blue + 0 blur-3xl + 0 side-stripes in live code; tsc adds no new errors.

STILL OPEN (not yet addressed):
- Pure-white: ~163 `bg-white` + ~241 `text-white` (no-pure-white rule only partially enforced).
- Whole dimensions untouched: accessibility (aria/focus/headings), responsive/touch-targets, UX copy/empty states.
- `shadcn-space/blocks/*` vendor demos still contain blue (unused, not routed).
- DESIGN.md typo: `fontSize: "1rem"I` in body typography.

### Round 4 — pure-white sweep (2026-05-31)

Eliminated pure-white tokens in live code (~754 → 0):
- `bg-white` → `bg-white-warm`; `bg-white/N` → `bg-[#fafaf8]/N`
- `text-white` → `text-cream`; `border/from/via/to/fill/stroke/ring-white` → cream / `#fafaf8`
- 65 files. Excluded: `components/ui/*` primitives, `shadcn-space/*` vendor, `Hero.tsx` (image-opt workstream).
- Verified 0 residual pure-white in live code; tsc adds no new errors (the one shadcn-space framer-motion error is pre-existing vendor).

STILL OPEN after Round 4:
- Accessibility pass (aria-labels on icon-only buttons, focus order, heading hierarchy, form-label coverage).
- Responsive / touch-target audit.
- UX copy / empty-state / error-state polish.
- `shadcn-space/blocks/*` vendor (unused) still has blue + a pre-existing TS error.
- `DESIGN.md` typo: `fontSize: "1rem"I`.
