# Design Fix Plan

Audit date: 2026-05-28
Source: impeccable audit — full site review
Status key: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Critical — Absolute ban violations

### 1. Experience section: Identical card grid [ ]
- **File:** `src/components/Experience.tsx`
- **Issue:** Three white cards, each with a large Lucide icon (Dumbbell, Coffee, Users) above a heading above body text. Same size, same background, same radius. Identical card grid + icon-above-heading = double ban.
- **Fix:** Replace with an asymmetric editorial layout. Options: full-width image-backed row for each pillar, a single large typographic block with smaller image insets, or a horizontal strip with image left + text right alternating. No icon grids.
- **Acceptance:** No identical card repeated more than once. No Lucide icon as the primary visual anchor above a heading.

### 2. Rental section: Glassmorphism floating badge [ ]
- **File:** `src/components/Rental.tsx`
- **Issue:** Floating "Up to 40 Guests" badge inside hero image uses `bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl` — decorative glassmorphism. Also: features below the image repeat the icon+heading+text grid (Calendar, Users, Sparkles).
- **Fix:** Replace the floating badge with a solid white-warm panel (`bg-[#fafaf8]`) with warm border, no blur. Restructure the three features as a text list or a split layout, not a card grid.
- **Acceptance:** No `backdrop-blur` on the badge. No icon card grid below the image.

### 3. Pricing + Boutique: Decorative blur blobs [ ]
- **Files:** `src/components/Pricing.tsx` (lines 186-188), `src/components/Boutique.tsx` (lines 57-58)
- **Issue:** Each section independently drops two `rounded-full blur-3xl` blobs as background "texture." Same visual move used on 3+ consecutive sections — signals template, not design.
- **Fix:** Remove the blob divs entirely. Use tonal background color shifts between sections (cream → sand → cream) to create separation without decoration. If a section needs visual energy, use photography or the typography itself.
- **Acceptance:** Zero `rounded-full blur-3xl` decorative elements anywhere in public pages.

---

## High impact

### 4. Testimonials: All 5-star ratings [ ]
- **File:** `src/components/Testimonial.tsx`
- **Issue:** All 6 testimonials hard-coded as 5/5 stars. Uniform perfect ratings signal fabrication to any discerning visitor and undermine the warm/authentic brand.
- **Fix:** Either (a) remove the star rating display entirely and let the quote speak, or (b) use realistic ratings (4–5 stars with at least one 4-star). Option (a) is cleaner and more authentic-feeling.
- **Acceptance:** No uniform all-5-star display.

### 5. Landing page: Identical section header structure [ ]
- **Files:** `Experience.tsx`, `Pricing.tsx`, `Rental.tsx`, `Boutique.tsx`, `Testimonial.tsx`
- **Issue:** Every section uses the same pattern: centered display heading 5-6xl + charcoal + paragraph subtext below. Zero variation in alignment, scale, or structure across the entire scroll.
- **Fix:** Break the pattern on at least 3 sections. Examples: make Rental heading left-aligned and oversized (7xl), make Testimonial heading italic-only with no subtext, make Boutique heading right-aligned, give Pricing a tight heading with a small descriptor label above it instead of a full paragraph below.
- **Acceptance:** At least 3 section headers have distinct alignment or scale treatment from the centered-display default.

---

## Medium impact

### 6. Portal milestones: Off-brand colors [ ]
- **File:** `src/pages/portal/dashboard.tsx` (lines ~70-82)
- **Issue:** Alchemist milestone uses `text-amber-600 bg-amber-50 border-amber-200`; Immortal uses `text-yellow-600 bg-yellow-50 border-yellow-200`. These Tailwind amber/yellow tokens are completely outside the brand palette.
- **Fix:** Map both to brand palette:
  - Alchemist: `text-terracotta bg-terracotta/10 border-terracotta/20`
  - Immortal: use a richer terracotta (`text-[#a05e38]`) or a deep sand tone
- **Acceptance:** No `amber-*` or `yellow-*` Tailwind utilities in milestone definitions.

### 7. Globals: Bricolage Grotesque unused import [ ]
- **File:** `src/app/globals.css` (line 1)
- **Issue:** `family=Bricolage+Grotesque:wght@200;300;400;500;600;700;800` in the Google Fonts URL. Never assigned to any CSS variable or Tailwind utility. Costs ~25KB per page load for zero visual return.
- **Fix:** Remove `Bricolage+Grotesque:wght@200;300;400;500;600;700;800&` from the import URL.
- **Acceptance:** Bricolage Grotesque absent from all CSS/HTML after fix.

### 8. Globals: Sidebar CSS variables duplicated 3× [ ]
- **File:** `src/app/globals.css` (lines 183-202, 279-287, 291-299)
- **Issue:** `--sidebar-*` variables defined three separate times, mixing HSL triplet and `hsl()` expression formats. Triple definition for the same set of tokens.
- **Fix:** Keep one canonical block in the `@layer base :root` at lines 183-202. Remove the duplicate raw-value blocks at 279-287 and 291-299. Verify sidebar still renders correctly.
- **Acceptance:** `--sidebar-background` (and all sidebar tokens) defined once only in globals.css.

### 9. Globals: No prefers-reduced-motion guard [ ]
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
| 1 | Experience: identical card grid | [ ] |
| 2 | Rental: glassmorphism badge | [ ] |
| 3 | Pricing/Boutique: blur blobs | [ ] |
| 4 | Testimonials: all 5 stars | [ ] |
| 5 | Section headers: zero variation | [ ] |
| 6 | Portal milestones: amber/yellow | [ ] |
| 7 | Bricolage unused import | [ ] |
| 8 | Sidebar CSS vars duplicated | [ ] |
| 9 | prefers-reduced-motion guard | [ ] |
