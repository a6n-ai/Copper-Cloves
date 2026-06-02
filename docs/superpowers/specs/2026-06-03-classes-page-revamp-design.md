# Public Classes Page Revamp — Design Spec

**Date:** 2026-06-03
**Surface:** `src/pages/classes.tsx` (`/classes`, public, Pages Router, `getStaticProps` + 5-min ISR)
**Register:** brand (marketing). Logged-out is marketing-focused; logged-in stays utilitarian (CTA destinations differ).
**Goal:** Turn the generic class catalog into a warm, on-brand marketing page that surfaces class descriptions and the instructor teaching each class, via editorial cards that open a quick-view detail modal.

## Decisions (locked in brainstorming)

- **Scope:** Classes catalog revamp + light visual polish of the Schedule tab (no behavior change). Hero/intro refreshed.
- **Card style:** Editorial — large image, Playfair title, peeking instructor avatar, "View details →". Flat at rest, lift on hover.
- **Expand mechanism:** Quick-view modal via existing `ResponsiveDialog` (dialog on desktop, bottom sheet on phone). Not inline.
- **Instructor depth:** Compact strip — avatar · name · title · specialty tags. Source = the single `ClassModel.instructor` (assigned instructor), not aggregated from schedules.
- **Imagery:** Mixed/some missing → branded fallback panel (sage gradient + class initials) whenever `image_url` is null.
- **Hero:** Editorial, left-aligned Playfair headline with one italic accent word + intro copy + a single committed image. **No stat panel** (copy-only). No sage+terracotta gradient.
- **Category filter:** Real filter chips (All + distinct categories), wiring up the currently-dead `selectedFilter` state.

## Critique fixes folded in (from impeccable critique, 26/40)

- **[P0] Data bug:** `getStaticProps` maps `cls.duration_minutes` and `cls.capacity`; schema fields are **`duration`** and **`max_capacity`**. Every card currently shows 60 min / 15 cap. Fix the mapping.
- **[P1] Instructor invisible:** surface assigned instructor (photo, name, title, specialties) in the modal + avatar on card.
- **[P1] Dead code:** remove the hardcoded `classDetails` array (`classes.tsx:67-208`) and the `ClassDetail` interface. (`ScheduleClass` / `DaySchedule` stay — used by the Schedule tab.)
- **[P1] Card treatment:** editorial card, flat-at-rest + hover lift, warm border (`#e5e4dc`) — fixes the Flat-By-Default violation (`border-0 shadow-lg`) and the identical-card-grid anti-pattern.
- **[P2] Truncated description, no escape:** modal carries the full description.
- **[P2] Benefits as long-text pills:** render benefits as a check-list inside the modal, not `Badge` pills.
- **[P2] `View Packages` CTA** routes to the booking flow; fix to route to packages.
- **[P3] Phantom filter:** render real category-chip UI driving `selectedFilter`.
- **[P3] Non-interactive cards:** make the whole card a keyboard-accessible trigger (button semantics, sage focus ring).

## Architecture

Single page, four extracted presentational components (keeps `classes.tsx` lean and each unit testable):

```
src/pages/classes.tsx                      # page: data (getStaticProps), tabs, state, schedule tab
src/components/classes/ClassCard.tsx       # editorial card; props: class + onOpen
src/components/classes/ClassDetailDialog.tsx # ResponsiveDialog quick-view; props: class | null, auth state, onClose
src/components/classes/InstructorStrip.tsx # avatar · name · title · specialty tags
src/components/classes/CategoryFilter.tsx  # chip row; props: categories, value, onChange
src/components/classes/classFallback.ts    # initials + brand-gradient helper for missing images
```

Each component takes plain props, no data fetching. The page owns all state and passes data down.

### Data flow

`getStaticProps` (ISR 300s) queries `prisma.classModel.findMany` ordered by `display_order` asc then `name` asc, `include: { instructor }` (omitting `studio_payout_cut_percent`, `hashed_password`). Transform to:

```ts
type PublicClass = {
  id: string;
  name: string;
  category: string;
  description: string;          // cls.description ?? ""
  benefits: string[];           // cls.benefits ?? []
  duration: number;             // cls.duration ?? 60      ← was cls.duration_minutes (bug)
  maxCapacity: number;          // cls.max_capacity ?? 15  ← was cls.capacity (bug)
  imageUrl: string | null;      // cls.image_url ?? null   (null drives the branded fallback)
  instructor: {
    name: string;
    title: string | null;
    imageUrl: string | null;
    specialties: string[];
  } | null;                     // cls.instructor mapped; null when unassigned
};
```

Schedule tab data flow is unchanged (`/api/class-schedules` client fetch + bucketing).

## Components

### ClassCard (editorial)
- Surface: `bg-white-warm` (`#fafaf8`), `border border-[#e5e4dc]`, `rounded-2xl` (16px), flat at rest.
- Hover/focus: lift shadow `0 4px 24px rgba(51,51,51,.08)`, border → `#d8d3c4`. Sage focus ring `0 0 0 2px #8f9779`.
- Image area (h-56/64): `imageUrl` via `<img>` `object-cover` with subtle `group-hover:scale-105` (guard with `prefers-reduced-motion`). When `imageUrl` is null → branded fallback (sage gradient + 2-letter class initials in Playfair).
- Category `Badge` top-left (white-warm pill, sage text). Instructor avatar (or initial) peeking bottom-right of the image.
- Body: Playfair title; meta line `"{duration} min · with {instructor.name}"` (omit "with …" if no instructor); `View details →` affordance in terracotta.
- The whole card is a `<button>`/`role=button` that calls `onOpen(class)`. No per-card "Book" button (booking lives in the modal).

### ClassDetailDialog (quick-view)
- Built on `ResponsiveDialog` (`@/components/responsive`) — dialog on desktop, bottom sheet on phone.
- Header image (or fallback) + category badge.
- Title (Playfair); meta row: `{duration} min · up to {maxCapacity} spots · {category}`.
- Full `description` (Montserrat body, line-height 1.7).
- "What you'll gain": `benefits` as a check-list (sage ✓), not pills. Hidden if empty.
- `InstructorStrip` (hidden if no instructor).
- CTA (auth-aware, reuses existing redirect logic):
  - logged-out → `Sign up to book` → `/portal/login?redirect=/portal/book`
  - logged-in → `Book this class` → `/portal/book`

### InstructorStrip
- Row on cream surface, warm border, rounded. Avatar (image or gradient + initial) · name (Montserrat semibold) · title (muted) · specialty tags (sand/sage chips, max ~4). All fields optional-safe.

### CategoryFilter
- Chip row. "All" + `distinct(classes.category)`. Active chip = sand fill (`#e8e4d9`), charcoal, medium weight; inactive = white-warm + warm border. Drives `selectedFilter`; `filteredClasses` already memoized.

### Hero
- Two-column on desktop (text + image), stacked on mobile. Cream background, no gradient.
- Left: uppercase kicker label, Playfair headline with one italic accent word, intro paragraph (≤75ch), Montserrat.
- Right: one committed image via `cdnUrl(...)` (existing studio asset); if unavailable, a single branded panel (sage gradient, no terracotta co-mix — respects the Two-Voice Rule). No stat panel.

### Schedule tab (light polish only)
- Keep all logic (week/month nav, bucketing, morning markers, empty states).
- Restyle to flat-at-rest: day columns with warm borders instead of heavy shadow; keep sage morning-class markers; align radii/spacing with the new cards. No data or behavior change.

### CTA section
- Keep sage band. Fix `View packages` to route to packages: logged-out → `/portal/login?redirect=/portal/packages`, logged-in → `/portal/packages` (new `handleViewPackages`, mirrors `handleBookClass`). `Book your first class` keeps `handleBookClass`.

## shadcnspace usage

Build on existing shadcn/ui primitives already in the repo (`Card`, `Badge`, `Button`, `Tabs`, `ResponsiveDialog`) styled to brand tokens. Use shadcnspace blocks as **reference patterns**, pulling via `getBlockInstall` only if a block accelerates a piece, then adapting to brand tokens:
- `product-quick-view-04` — description-heavy quick-view modal (reference for ClassDetailDialog).
- `team-05` / `team-01` — person card with credentials/tags (reference for InstructorStrip).
- `gallery-02` — masterclass/session card imagery (reference for ClassCard).
Brand tokens (sage `#8f9779`, terracotta `#c17856`, cream `#f5f2ea`, warm border `#e5e4dc`, Playfair/Montserrat) override any block defaults. No pure `#fff`/`#000`. No em dashes in copy.

## Accessibility

- Card trigger: real button semantics, Enter/Space opens modal, visible sage focus ring.
- Dialog: Radix focus trap + Esc close (via ResponsiveDialog); descriptive title.
- Images: meaningful `alt` (class name); fallback panels `aria-hidden` decorative with accessible name on the card.
- `prefers-reduced-motion`: disable hover scale + entrance motion.
- Contrast: AA for body + chips (charcoal on cream/sand passes; sage text on white-warm verified).

## Out of scope

- No schema changes. All fields already exist.
- No change to booking flow, auth, or `/api/classes` shape (only the page's transform mapping is corrected).
- No aggregation of multiple instructors per class (single assigned instructor only).
- Schedule tab keeps its current data/behavior.

## Testing / verification

- Build the page; confirm cards render real `duration` and `max_capacity` (P0 fix) for several classes.
- A class with `image_url = null` shows the branded fallback, not a broken image.
- A class with no assigned instructor: card meta omits "with …"; modal hides the instructor strip; no crash.
- Filter chips narrow the grid by category; "All" restores.
- Modal CTA: logged-out routes to login-with-redirect; logged-in routes to book.
- `View packages` routes to packages, not book.
- Keyboard: tab to a card, Enter opens modal, Esc closes, focus returns.
- Mobile: modal renders as bottom sheet; grid is single-column; hero stacks.
