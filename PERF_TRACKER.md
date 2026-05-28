# Perf Tracker

Vercel React rules audit + remediation. Tracks all findings from initial scan + rescan.

Legend: `[x]` done · `[ ]` pending · `[~]` in progress · `[-]` deferred (needs discussion)

---

## Session 2026-05-28 — paused for dev test

~30 items landed across React rerender hygiene, Pages Router platform wins, and bundle hygiene.

### Test-on-dev checklist (regression surface)

Hit these flows in `npm run dev` first — they're the surfaces this session touched:

1. **Fonts** — every page should still show Playfair Display headings + Montserrat body (no FOUT to system fonts). Marketing pages should paint without the Google Fonts blocking request in Network tab.
2. **Cart** — add / remove / update qty across `/portal/menu`, `/shop`, `/cafe`. Cart badge in `Navigation` must reflect changes; checkout totals must match.
3. **Responsive dialogs** — open any admin dialog (e.g. `admin/members` → Manage), resize browser across 768px. Should NOT remount the form mid-edit. Mobile sheet variant should still appear under 768px on first open.
4. **Activity tracking** — open DevTools → Network. Page nav should still emit `page_view`. Tab hidden for 30s should pause the 15s flush; tab visible should resume + flush.
5. **Check-in countdown / beacon** — `/instructor/dashboard`. 1-Hz countdown should pause when tab hidden; instructor beacon should render correctly.
6. **Class countdown pill** — on `/admin/dashboard` overview "Today's classes" carousel.
7. **Sign-up form** — `/portal/signup`. Type into password field; the rest of the form should NOT visibly re-flash on every keystroke. Suggest-strong button still fills both password fields.
8. **Path to Mastery + Vitality area chart** — `/portal/dashboard`. Charts should render; milestone progress should still animate on first paint.
9. **Order history table** — `/portal/dashboard` or `/portal/bookings`. Date column, status badge, payment label should all render identically.
10. **Mobile bottom nav** — under 768px, primary tabs + More sheet still work; scanner FAB (member/instructor) opens scan modal.
11. **Admin Finance tab** — open a Finance-1 row → detail dialog should still open with full breakdown.
12. **Admin Classes tab** — Peak Hours heatmap colors should still gradient correctly; hover scale still works.
13. **Admin Overview tab** — Today carousel cards; date prev/next/today buttons; member selection checkboxes shouldn't re-render the carousel.
14. **Landing `/`** — Hero videos still autoplay; below-the-fold sections (Instructors, Pricing, Founder, Rental, Boutique, Testimonial) should still appear as user scrolls (now lazy-loaded via `next/dynamic`).
15. **Public API caching** — `/api/classes`, `/api/retail-products`, `/api/cafe/items`, `/api/packages`, `/api/class-schedules` (anon). Check Response headers for `Cache-Control: public, s-maxage=…`. Anon hits must NOT return `studio_payout_cut_percent` (was leaking via `include: instructor`).
16. **Auth-scoped APIs** — `/api/class-schedules` while signed in should still return `private, no-store`; `/api/user-stats` should return `private, max-age=10, swr=60`.
17. **GA + Softgen scripts** — Network tab: `googletagmanager.com/gtag/js?id=…` should fire after interactive; `cdn.softgen.ai/script.js` should fire on lazy load (not blocking first paint).
18. **Razorpay checkout** — book a class or buy a package and complete a test payment. Preconnect should warm the Razorpay origin earlier than before.
19. **NumberTicker** — admin dashboard metric cards animating from 0 → value should reach the correct end value (no off-by-one from the ref change).
20. **Pagination** — any admin table with >10 rows. Page-pill click should snap to active page (no more FLIP spring animation — this is intentional).

### Watch for
- Build still passes (`npm run build`) — `next/font` + `next/script` migration touches the build pipeline.
- Hydration warnings in console for the wrapped `<div>` in `_app.tsx` (the font-variable wrapper).
- Any `prisma.classModel.findMany` callers downstream that expected `studio_payout_cut_percent` to be present on `instructor` — it's now `omit`ed.

### Still pending after this session
- Auth gSSP migration across ~25 pages (kills flash-of-unauth)
- `next/image` migration (~9 `<img>` sites)
- `pages/classes.tsx`, `shop.tsx`, `shop/[id].tsx` → `getStaticProps` + ISR
- `DashboardChrome` scalar session destructure
- SWR migration for shared endpoints
- Hero video `poster` JPEGs (needs uploaded assets, not a code-only change)
- `next.config.mjs` `remotePatterns` tightening (needs full image-host audit)

---

## Bundle (CRITICAL)

- [x] `admin/dashboard.tsx` — recharts (11 components) wrapped in `next/dynamic({ssr:false})`
- [x] `admin/control.tsx` — `ControlAnalyticsPanel` (~700 lines) dynamic
- [x] `admin/schedule/[id].tsx` — edit + status dialogs gated with `{open && ...}` so JSX subtrees are skipped when closed
- [x] `components/checkin/CheckInScanButton.tsx` — `ScanCheckInModal` (camera/jsqr) via `next/dynamic({ssr:false})`; only mounts when `open=true`
- [x] `portal/book.tsx` — razorpay helpers (`payWithRazorpayOrder`, `razorpayPaymentErrorHelp`, `completePendingBookingCheckout`, `completePendingPackageCheckout`) all migrated to dynamic `import()` inside handlers
- [x] `portal/packages.tsx` — same razorpay helpers dynamic
- [x] `admin/schedule/[id].tsx` — edit + status dialogs gated with `{open && ...}` so JSX subtrees are skipped when closed

## Scroll / event listeners

- [x] `pages/cafe.tsx` — scroll listener rAF-throttled; `getBackgroundColor` pure module fn
- [x] `components/Instructors.tsx` — scroll listener now rAF-throttled + DOM-ref mutation; was setState-per-pixel re-rendering the whole instructor list
- [x] `components/Navigation.tsx` — scroll listener now rAF-throttled + compare-and-skip; only `setState` when the 24-px threshold actually flips

## Polling visibility pause

- [x] `components/checkin/CheckinBeacon.tsx` (60s) — pause when `document.hidden`
- [x] `components/checkin/CheckinQrDialog.tsx` (15s)
- [x] `components/checkin/InstructorCheckinBeacon.tsx` (1s, also stops when no window active)
- [x] `pages/admin/cafe.tsx` (10s)
- [x] `pages/admin/kitchen/index.tsx` — 20s poll now pauses when `document.hidden`; re-fires on `visibilitychange` resume

## Duplicate fetch dedup

- [x] `pages/admin/cafe.tsx` — `fetchOrders` + `fetchOrderHistory` merged into one `fetchAllOrders`
- [ ] `pages/admin/CRM.tsx` L300 — `fetchAnalytics` re-fetches `/api/admin/crm/messages` already loaded
- [-] `pages/shop/[id].tsx` L61-105 — refetches catalog; still fetched but unblocked by detail (uses Promise.all). Deferred full dedup pending shared store/SWR.

## Hoist module-level constants

- [x] `components/Hero.tsx` — `moveMedia`, `refuelMedia`
- [x] `pages/cafe.tsx` — `analogImages`, `heroMedia`, `galleryImages`
- [x] `pages/cafe/meal-subscription.tsx` — `heroImages`
- [x] `pages/portal/menu.tsx` — `CATEGORIES`
- [x] `components/Pricing.tsx` — `classPassPackages`, `studioPassPackages` hoisted
- [x] `components/Founder.tsx` — `features`, `stats` hoisted
- [x] `components/dashboard/PathToMastery.tsx` — framer `LIST_VARIANTS`, `ITEM_VARIANTS` hoisted (was destabilizing motion stagger on parent rerenders)
- [-] `components/dashboard/mobile/MemberMobileDashboard.tsx` L196 — quick-book array (closures over `router`/`onShowOrderHistory` — minor; skipped)

## Derived state via setState → `useMemo`

- [x] `admin/members.tsx` — `filteredMembers`
- [x] `admin/credits.tsx` — `filteredTransactions`
- [x] `portal/menu.tsx` — `filteredItems`
- [x] `portal/book.tsx` — `calculateTotals` wrapped in `useCallback`; `totals` cached via `useMemo` (was invoked twice per render)
- [x] `admin/products.tsx` — order totals into single-pass `useMemo`; filteredProducts/paginatedProducts/paginatedOrders memoized; toLowerCase haystack once per filter call
- [x] `admin/TodayClassesCarousel.tsx` — `nextIndex` IIFE → `useMemo`
- [x] `admin/ControlAnalyticsPanel.tsx` — `maxRev` + `maxGrowth` `useMemo`
- [x] `portal/packages.tsx` — `recommendedIndex`, `pagedHistory` `useMemo`
- [x] `portal/bookings.tsx` — sort precomputes `startMs` once per booking (was building a Date per compare); `sortedBookings` + `paginatedBookings` `useMemo`
- [x] `pages/classes.tsx` — `filteredClasses` `useMemo`; `activeTab` effect now depends on `router.query.tab` scalar (not object)
- [x] `portal/bookings.tsx` — `sortedBookings` + `paginatedBookings` already `useMemo` (landed in earlier pass; verified at L295/L302).
- [x] `portal/dashboard.tsx` — `activeMilestones` `useMemo`; combined `currentMilestone`+`nextMilestone` single-pass `useMemo`; `statItems`/`upcomingEntries`/`orderRows` all wrapped in `useMemo` so memoized children get stable refs
- [x] `pages/classes.tsx` — `activeTab` effect now depends on scalar `queryTab = router.query.tab` (with explanatory comment); already in tree from earlier pass.

## Session-object deps → scalar role/id

- [x] `pages/admin/dashboard.tsx` — 6 effects
- [x] `pages/admin/credits.tsx`
- [x] `pages/admin/cafe.tsx`
- [x] `pages/portal/dashboard.tsx`
- [x] `pages/portal/menu.tsx`
- [x] `pages/admin/schedule.tsx` — `userRole` scalar; loadDbData+loadSchedule via Promise.all (was sequential)
- [x] `pages/admin/control.tsx` — `userRole` scalar
- [x] `pages/shop.tsx` — `sessionEmail` scalar
- [x] `pages/instructor/dashboard.tsx` — `userRole` + `userName` scalars; `selectedClassId` via ref to stabilize `loadData`
- [x] `pages/partner/classes.tsx` — drop `rangeStart`/`rangeEnd` Date deps; `rangeKey` already encodes them
- [-] `pages/admin/members.tsx` (eslint-disable masks — low impact, keep as-is)
- [-] `pages/cafe.tsx` — no `router`/`session` deps left after hoist; not worth further touching
- [-] `pages/classes.tsx` — already migrated to `router.query.tab` scalar earlier
- [-] `pages/cafe/meal-subscription.tsx` — no `router`/`session` deps

## setTimeout cleanup

- [x] `components/CheckoutModal.tsx`
- [x] `pages/portal/menu.tsx`
- [x] `pages/partner/settings.tsx`

## Re-render storms (extract memoized child)

- [x] `admin/dashboard.tsx` (4972 → 2347 lines, -2625, -52.8%) — all 8 tabs split into own files + React.memo. Unused imports + dead helpers (`parseYYYYMMDDLocal`, `txnPassesDateRange`, `formatTxnAmountRupee`, `formatInrDetail`) removed.
  - **CHART FIX**: recharts components MUST be statically imported, not wrapped in `next/dynamic` per-component — recharts inspects children's class to decide layout, dynamic wrappers break that. Each chart-tab file imports recharts statically; the tab itself is `next/dynamic` from dashboard, so recharts JS still defers until tab opens.
- [x] `admin/MetricCard.tsx` — `React.memo` (used 50+ times across dashboard — was re-rendering on every parent state tick)
- [x] `admin/DayScheduleList.tsx` — `toggleSort` wrapped in `useCallback`; sort wrapped in `useMemo` (was sorting on every render)
  - [x] `meal-waitlist` tab → `dashboard-tabs/MealWaitlistTab.tsx` (memoed)
  - [x] `rental-inquiries` tab → `dashboard-tabs/RentalInquiriesTab.tsx` (memoed)
  - [x] `pricing` tab → `dashboard-tabs/PricingTab.tsx` (memoed); handlers wrapped in `useCallback`
  - [x] `instructors` tab → `dashboard-tabs/InstructorsTab.tsx` (memoed + `next/dynamic` lazy); chart data memoized; pagination internal
  - [x] `classes` tab → `dashboard-tabs/ClassesTab.tsx` (memoed + `next/dynamic` lazy); chart data memoized; pagination internal
  - [x] `members` tab → `dashboard-tabs/MembersTab.tsx` (memoed + `next/dynamic` lazy); filter/sort/pagination internal; `handleViewProfile` wrapped in `useCallback`
  - [x] `finance` tab → `dashboard-tabs/FinanceTab.tsx` (memoed + `next/dynamic` lazy); txn filters/search/pagination/detail-dialog internal; `handleExportFinance` wrapped in `useCallback`
  - [x] `overview` tab → `dashboard-tabs/OverviewTab.tsx` (memoed + `next/dynamic` lazy); `selectedMembers` checkbox state internal; `handleSelectOverviewClass` wrapped in `useCallback`
- [ ] `admin/DayScheduleList.tsx` L118,175,212 — sort runs each render; TableRow not memoed; toggleSort not useCallback
- [ ] `admin/TodayClassesCarousel.tsx` L114,156 — memoized card + StatusChip
- [ ] `admin/ControlAnalyticsPanel.tsx` L181..L635 — 11 unmemoized bar-rows → BarRow memo
- [ ] `admin/MetricCard.tsx` L54 — wrap React.memo
- [ ] `components/Instructors.tsx` L355-433 — extract `<InstructorCard>` React.memo
- [x] `portal/book.tsx` — extracted memoized `BookClassCard`; `handleSelectClass` wrapped in `useCallback` so memo actually skips rerender when only unrelated page state changes (food qty, friends/family typing, coupon validate)
- [x] `portal/book.tsx` — café row extracted into memoized `<FoodRow>` (mirrors `BookClassCard` pattern); `handleFoodQuantity` wrapped in `useCallback` so qty tick on one item no longer re-renders every other row.
- [x] `portal/bookings.tsx` — single memoized `BookingCard` replaces dual mobile-card + desktop-card render (was 2× DOM per booking); `ResponsiveCards` no longer needed
- [ ] `portal/dashboard.tsx` L548-553 — memo action-button array

## Iteration hotspots (`js-index-maps`, `js-combine-iterations`)

- [x] `admin/CRM.tsx` — `TEMPLATE_TYPES`/`TRIGGER_TYPES` hoisted to module scope; `templateLabelById`/`triggerLabelById` Maps replace `.find()` in table rows
- [x] `admin/schedule.tsx` — `dbClassById` + `dbInstructorById` Maps (`useMemo`); `getClassName`/`getClassCapacity`/`getInstructorName`/`getInstructorAvatar` now O(1) lookups
- [-] `admin/control.tsx` L656 — `users.find` runs once per `editUser` query change (not per render); skip
- [x] `admin/products.tsx` — `categoryById` Map (landed earlier)
- [x] `admin/cafe.tsx` — `categoryLabelById` Map; replaces `categories.find()` per menu item row
- [x] `admin/schedule/[id].tsx` — `enrolled`/`checkedIn` combined into single-pass `useMemo` (was two scans over bookings)
- [x] `admin/kitchen/index.tsx` — three filter scans collapsed into one `useMemo` pass producing `{active, pendingCount, completedToday}`
- [x] `portal/dashboard.tsx` — L201 `activeMilestones` memoized earlier; L312/346 chains live inside `fetchUserData` (fetch-time only, not per-render)
- [x] `portal/menu.tsx` — `categoryLabelById` Map from module-scope `CATEGORIES`; replaces `categories.find()` per menu card
- [x] `instructor/dashboard.tsx` — single-pass `useMemo` produces `totalEnrolled` + `totalCheckedIn` + `classesByDay` (was 3 separate scans per render); `classById` Map replaces `classes.find()` for `selectedClass`
- [x] `portal/book.tsx` — `startTimeMs` precomputed on each class in the transform; both sort callsites (initial sort + filter-sort) compare integers (was `new Date(.startTimeIso).getTime()` per compare)
- [x] `portal/book.tsx` L839 — sequential `await fetch` in loop → `Promise.all` (café orders fire concurrently)
- [x] `pages/classes.tsx` — 7×N filter → single bucket pass via `floor((itemMs - weekStartMs)/MS_PER_DAY)`
- [x] `shop.tsx` — lowercased haystack precomputed once per `products` change (was 5× toLowerCase per product per keystroke)
- [x] `shop/[id].tsx` — `addItem(item, qty)` overload; single setState (was N rerenders looping `addItem`)

## Waterfalls (`async-parallel`)

- [x] `admin/CRM.tsx` — templates/messages/triggers fired via `Promise.all`; analyticsData derived from `messages` via `useMemo` (no second `/api/admin/crm/messages` fetch)
- [x] `admin/schedule.tsx` — loadDbData + loadSchedule via `Promise.all` (was sequential)
- [x] `profile/ProfileSection.tsx` — profile + tickets via `Promise.all` (was sequential)

## Subtle bugs

- [x] `components/CheckoutModal.tsx` L83 — setTimeout leak (fixed via cleanup)
- [x] `components/CheckoutModal.tsx` — `setFormData` now uses functional updater (was racy under fast typing)
- [x] `components/Instructors.tsx` — `document.body.style.overflow` restored on unmount (no more leak on route change with modal open)
- [x] `profile/ProfileSection.tsx` — avatar PUT now checks `!ok` and toasts on failure (was silent S3 fail)
- [x] `components/checkin/CheckinBeacon.tsx` — drag listeners now bound once via `useEffect([], [])`; latest `dragging`/`pos` read via refs (was re-attaching window listeners on every pixel of drag)

## Cross-cutting (project-wide)

- [ ] SWR migration — `/api/class-schedules`, `/api/cafe/items`, `/api/user/profile` hit from multiple pages
- [ ] Verify Razorpay `<script>` strategy not `beforeInteractive`
- [ ] Remove `eslint-disable react-hooks/exhaustive-deps` sites — wrap loaders in useCallback

## Up/Down sort on all admin dashboard tables

Shared infra at `src/components/admin/sortable-table.tsx`:
- `useTableSort<T, K>(items, { initialKey, initialDir, getValue, defaultDirFor })` — sort hook with stable `toggle`
- `<SortableHeader sortKey active dir onToggle>` — wraps `TableHead`, shows up/down/inactive chevrons

Applied to:
- [x] `InstructorsTab` — sort by Instructor / Rating / Classes / Check-Ins / Avg Attendance / Earnings (default: Check-Ins desc)
- [x] `ClassesTab` — sort by Class / Discipline / Spots / Utilization (default: Utilization desc)
- [x] `FinanceTab` — sort by Category / Member / Date / Method / Amount (default: Date desc; expense amounts ordered as negatives)
- [x] `PricingTab` — sort by Code / Scope / Discount / Uses / Status; pagination moved internal
- [x] `MealWaitlistTab` — sort by Date / Name / Status; pagination moved internal
- [x] `RentalInquiriesTab` — sort by Date / Name / Event / Status; pagination moved internal
- [x] `MembersTab` — already had per-column sort (pre-existing)
- [x] `DayScheduleList` — already had per-column sort (pre-existing)

Non-dashboard admin tables (sort already worked on some columns; added missing + migrated visuals to shared `SortableHeader` where applicable):

- [x] `admin/members.tsx` — added sort on **Pass** and **Account** columns (was: Name/Classes/Last Visit/Status only); all inline buttons migrated to `SortableHeader`
- [x] `admin/credits.tsx` — migrated inline sort buttons to `SortableHeader`; removed obsolete `sortIcon` helper
- [x] `admin/badges.tsx` — migrated PTM badges table inline sort buttons to `SortableHeader`; removed obsolete `ptmSortIcon` helper
- [x] `admin/control.tsx` users table — added sort on **Pass / Remaining / Start** (was: Name/End/Status only)
- [x] `admin/control.tsx` payouts table — added sort on **Rate / Share** (was: Instructor/Check-ins/Total/Status only)

---

# Round 2 — New findings (component + Next.js scan)

Fresh scans against files NOT previously reviewed + Next.js Pages Router-specific patterns. Ordered roughly by impact.

## R2 · React rerender / leak (highest leverage)

- [x] `contexts/CartContext.tsx` — `value` wrapped in `useMemo`; `addItem`/`removeItem`/`updateQuantity`/`clearCart` wrapped in `useCallback` (empty deps; all use functional setState). `itemCount`+`subtotal` collapsed into single-pass `useMemo([items])`. `updateQuantity` inlined remove path (no cross-handler dep).
- [x] `components/responsive/ResponsiveDialog.tsx` — single `RespCtx` context; only the Root calls `useIsMobile()`, all parts read context. Value frozen for the open session (snapshot on open, cleared on close) so resize across 768px no longer unmount/remount the subtree mid-edit.
- [x] `hooks/useActivityTracking.ts` — pageview effect now `[]` deps with `statusRef` for live status read (was re-binding listener + re-firing initial `page_view` on every router/session tick). 15s flush interval paused on `document.hidden`; flushes once + restarts on `visibilitychange` resume.
- [x] `components/checkin/ClassCountdownPill.tsx` — 1-Hz tick paused on `document.hidden`; resumes on visibilitychange (with immediate `setNow` so the label snaps fresh). `startMs`/`endMs` `useMemo([startIso, endIso])` — no more 60 `new Date()` parses per minute.
- [x] `components/checkin/InstructorCheckinBeacon.tsx` — `active` + `anyEverActive` collapsed into single-pass `useMemo([classStarts, now])` (no `Date.now()` during render; one loop instead of `some` + `filter` + `sort`). Interval now genuinely stops on `document.hidden` (not just early-returns) and snaps fresh on visibilitychange resume.
- [x] `components/dashboard/AnimatedIcon.tsx` — wrapped in `React.memo`; `initial`/`animate`/`transition` literals hoisted to module-scope constants (`INITIAL_MOUNT`, `ANIMATE_MOUNT`, `SPRING_TRANSITION`) so every instance shares stable refs. With primitive props (icon ref, size, hover string) equal, memo now actually skips renders.
- [x] `hooks/useAuthWeather.ts` — `palette` + `greeting` both `useMemo([weather])`; `new Date()` only called when weather payload changes.
- [x] `components/admin/dashboard-tabs/FinanceTab.tsx` — row body extracted into `FinanceRowView` (React.memo); click handler hoisted to `handleSelectFinance` (`useCallback`) so memo doesn't bust on identity. `REVENUE_TREND_PLACEHOLDER` array hoisted to module scope (was re-allocated every render).
- [x] `components/admin/dashboard-tabs/ClassesTab.tsx` — Peak-Hours heatmap cells extracted into memoized `<HeatCell>`; intensity/opacity/title now computed inside the cell (per-cell skip on parent rerenders).
- [x] `components/admin/dashboard-tabs/MembersTab.tsx` — `displayedMemberStats` + `activeMemberTierTotal` both wrapped in `useMemo` with scalar deps (was reallocating the spread object every render even when nothing changed).
- [x] `components/admin/dashboard-tabs/OverviewTab.tsx` — `todayIso`/`y`/`m`/`d`/`dateTitle` collapsed into single `useMemo([scheduleDate])`; carousel `items` now memoized via `carouselItems = useMemo([todayClassesDetail, upcomingClasses])` (was rebuilding 10-key shape per render, forcing `TodayClassesCarousel` to re-diff every card on unrelated state changes).
- [x] `components/dashboard/UpcomingScheduleCard.tsx` — `formatWhen` precomputed per entry in `useMemo([entries])`; rendered row reads cached `when` string (was reparsing Date + 2× `toLocale*` per row per render).
- [x] `components/dashboard/OrderHistoryTable.tsx` — display strings (dateLabel, statusBadge, statusBadgeClass, methodLabel) precomputed per row in `useMemo([rows])`; row body extracted into `OrderRowView` wrapped in `React.memo` so unchanged rows skip render.
- [x] `components/dashboard/VitalityAreaChart.tsx` — `data` `useMemo([series])`; recharts no longer re-diffs paths on parent rerenders.
- [x] `components/dashboard/PathToMastery.tsx` — `pct`/`gradient`/`trackLeft`/`trackSpan` collapsed into single `useMemo([milestones, classesCompleted])`; unused `target` dropped. (Extracting `<MilestoneTier>` deferred — would need to thread color/earned/isCurrent/tier handlers, low marginal value given the math now memoized.)
- [x] `components/auth/SignUpForm.tsx` — removed `useWatch({name:"password"})`; password read inside the onChange via `getValues("password")` (was rerendering the entire form on every keystroke).
- [x] `components/checkin/CheckinBeacon.tsx` — explicit staleness comment added to `badgeLabel`: 60s poll cadence matches the badge's minute resolution, so no separate `setInterval` needed; label intentionally freezes while tab hidden (poll paused) and snaps fresh on visibilitychange.
- [x] `components/checkin/CheckinQrDialog.tsx` — `validUntil` `useMemo([data?.startTime])` (was reparsing + reformatting Date every render).
- [x] `components/checkin/ClassCheckinQr.tsx` — `isFinder` + 169-cell `cells` array hoisted into module-scope `FAKE_QR_CELLS` IIFE (computed once at import, rendered identically every time).
- [x] `components/responsive/MobileBottomNav.tsx` — `all`/`overflow`/`showMore`/`showScanner`/`slots` collapsed into single `useMemo([config])`; `Map`/`Set` allocations + `flattenNavItems` only run on config change, not on every route push.
- [x] `components/SEO.tsx` — `DEFAULT_OG_IMAGE` + `FAVICON_SVG` + `FAVICON_ICO` hoisted to module consts (`cdnUrl` was being re-evaluated on every `<SEO>`/`<SEOElements>` render).
- [x] `components/admin/NumberTicker.tsx` — added `currentRef` updated inside rAF; `fromRef.current = currentRef.current` (was reading the stale render-time `value` snapshot, which lagged the actually-displayed number on rapid `end` changes).

## R2 · Next.js Pages Router optimization (highest leverage)

### Marketing pages — SSR per request → should be SSG/ISR

- [-] `pages/index.tsx` · `founder.tsx` · `rental.tsx` · `policy.tsx` · `terms.tsx` — no data deps, no `useSession`, no `getServerSideProps`/`getInitialProps`. Pages Router already statically optimizes these at build (`Automatic Static Optimization`). Adding an empty `getStaticProps` is a no-op vs current behavior.
- [-] `pages/cafe.tsx` — gallery static but page imports interactive components + a scroll listener; conversion to `getStaticProps` provides no TTFB benefit since the page already has no data dep. Skipped.
- [ ] `pages/classes.tsx` L25 — `/api/classes` always fetched on mount; convert to `getStaticProps` + ISR (class catalog rarely changes). Keep schedule list client-side. **Still pending — would need to refactor the existing client `fetch` flow.**
- [ ] `pages/shop.tsx` L91 — `/api/retail-products` fetched in `useEffect`; convert to `getStaticProps` + ISR (60s) for SEO/LCP. **Still pending.**
- [ ] `pages/shop/[id].tsx` — product detail per-id, currently client-fetches every load; use `getStaticPaths` + `getStaticProps` with ISR. **Still pending.**

### Bundle / code splitting

- [x] `pages/index.tsx` — `Instructors`, `Pricing`, `Founder`, `Rental`, `Boutique`, `Testimonial` wrapped in `next/dynamic`. SSR kept on so SEO crawlers still see content; only the JS download for these sections is deferred. Above-the-fold `Navigation`, `Hero`, `ClassCatalog`, `Footer` stay static-imported.
- [ ] `pages/portal/dashboard.tsx` L16 — `MemberMobileDashboard` always imported even though only mobile renders; wrap both mobile + desktop variants in `next/dynamic({ssr:false})` and gate on `isMobile`.
- [x] `components/Pagination.tsx` — `framer-motion` import dropped; active-page pill switched to CSS `transition-colors` on the link itself (no FLIP). One less framer instance per dashboard page that uses Pagination.

### Hero / LCP

- [ ] `components/Hero.tsx` L41-99 — three `<video autoPlay>` mount eagerly; only mid-panel is LCP. Lazy-mount left/right panels via `IntersectionObserver`.
- [x] `components/Hero.tsx` — all four hero videos now `preload="metadata"` (default `auto` was pulling full MP4 on first paint).
- [-] `components/Hero.tsx` poster attribute — deferred. Requires per-video poster JPEGs uploaded to S3; out of scope for code-only pass.

### Auth flash-of-content (FOUC)

- [ ] Move client-side auth redirects to `getServerSideProps` with session check + redirect. Eliminates ~200-400ms unauth flash. Applies to: `admin/{dashboard,cafe,credits,members,schedule,control,CRM,badges,partners,products,kitchen/*,instructors/*}`, `partner/*`, `instructor/dashboard`, `portal/{dashboard,book,bookings,packages,profile,menu}`.

### Image optimization (`<img>` → `next/image`)

- [ ] `components/Footer.tsx` L17 — logo
- [ ] `components/Instructors.tsx` L103,108 — instructor cards
- [ ] `components/Testimonial.tsx` L98 — testimonial portrait
- [ ] `components/profile/ProfileSection.tsx` L434 — avatar preview
- [ ] `pages/instructor/dashboard.tsx` L103 — avatar
- [ ] `pages/admin/schedule.tsx` L1684 — booking avatars
- [ ] `pages/admin/cafe.tsx` L796,927,1144 — menu item images
- [ ] `pages/admin/control.tsx` L1719,2532,2656,2815,2982 — class/instructor previews

### Fonts

- [x] `styles/globals.css` L1-3 — Google Fonts `@import url()` removed; migrated to `next/font/google` (Playfair Display + Montserrat) in `_app.tsx`. `--font-playfair` / `--font-montserrat` CSS vars piped through `--font-display` / `--font-body` / `--font-script` / `--font-anchor` so call-sites untouched. Bricolage dropped (was imported, never used).

### Scripts

- [x] `_document.tsx` GA + Softgen — moved both to `_app.tsx` using `next/script`. GA = `strategy="afterInteractive"`; Softgen = `strategy="lazyOnload"` (was blocking-async in `<head>`, competing with first paint).
- [x] `_document.tsx` preconnect — added `preconnect` + `dns-prefetch` for `checkout.razorpay.com`. (Google Fonts hosts no longer needed — migrated to `next/font/google` which self-hosts. S3/CDN preconnect deferred — needs concrete host once we tighten `remotePatterns`.)
- [-] `lib/razorpayCheckout.ts` Razorpay SDK preload — preconnect now in place; full SDK preload via `next/script` deferred (current DOM-inject is gated to checkout click, so first paint isn't blocked).

### Navigation

- [ ] `pages/classes.tsx` L438 — `router.push("/portal/book")` from click handler should be `<Link href>` (enables prefetch).

### API routes — caching + payload

- [x] `pages/api/retail-products.ts` — `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` on both detail + list paths. (Column slimming via `select` deferred — current shape is the documented public response.)
- [x] `pages/api/cafe/items.ts` — anon GET now `public, s-maxage=30, stale-while-revalidate=120`.
- [x] `pages/api/classes.ts` — `public, s-maxage=300, stale-while-revalidate=600`; `instructor` join now uses `omit: { studio_payout_cut_percent, hashed_password }` to plug the sensitive-field leak (was `include: instructor` returning everything).
- [x] `pages/api/packages.ts` — public list GET now `public, s-maxage=300, stale-while-revalidate=600`.
- [x] `pages/api/class-schedules.ts` — anon (no NextAuth session cookie) gets `public, s-maxage=60, stale-while-revalidate=300`; auth path keeps `private, no-store`.
- [x] `pages/api/user-stats.ts` — `private, max-age=10, stale-while-revalidate=60` to dedupe portal-dashboard refetches without leaking across users.
- [ ] `pages/api/admin/badges.ts` L54,62,68 — 3 unbounded `findMany` on `badgeTemplate`; admin-only but still no `select`/pagination.

### Session / NextAuth

- [ ] `pages/_app.tsx` L51,105 — `DashboardChrome` + `OnboardingGate` both call `useSession()` for full `session` data when status is enough. Causes rerender of these wrappers on every session refresh (every 4 min after our refetchInterval change).
- [ ] `pages/portal/dashboard.tsx` L153 — destructures full `session` then derives role/email; switch to scalar reads.
- [ ] `pages/classes.tsx` L430 — `session` destructure used only for role/id.
- [ ] `pages/_app.tsx` L67 — `/api/partner/profile` fetched client-side after auth; should be passed via `getServerSideProps` on partner pages to avoid topbar logo flash.

### Build config

- [x] `next.config.mjs` — `images.minimumCacheTTL: 31536000` added (one-year CDN cache; image URLs are S3 content-addressed, new uploads change the key).
- [-] `next.config.mjs` `remotePatterns` — still `**`. Tightening requires concrete audit of every external image host (admin uploads, instructor avatars, externally pasted URLs). Deferred.
- [-] `next.config.mjs` `/fonts/*` cache headers — N/A. Fonts now self-hosted by `next/font/google`, which emits immutable cache headers automatically. No custom font dir to configure.

## R2 · Highest-leverage shortlist (recommended order)

1. **`next/font/google` migration** (drop Google Fonts `@import` from `globals.css`) — biggest LCP win for every marketing page in one change.
2. **`CartContext` value memoization** — cuts rerenders of cart consumers app-wide.
3. **`ResponsiveDialog` single-`useIsMobile` refactor** — fixes form-state-loss-on-resize + cuts matchMedia listeners.
4. **Marketing pages → `getStaticProps` + ISR** (`/`, `/founder`, `/rental`, `/policy`, `/terms`, `/cafe`, `/shop`, `/shop/[id]`, `/classes`).
5. **Hero video lazy-mount + `preload="metadata"` + `poster`** — landing LCP.
6. **`pages/index.tsx` below-the-fold sections via `next/dynamic`** — landing bundle size.
7. **Auth-gated pages → `getServerSideProps` redirect** — kills flash-of-unauth-content site-wide.
8. **Public API caching headers** (`/api/retail-products`, `/api/cafe/items`, `/api/classes`, `/api/packages`, `/api/class-schedules` for anon).
9. **Image migration to `next/image`** across the file list above.
10. **Background tick pause** on `ClassCountdownPill` + `InstructorCheckinBeacon` (battery drain).

## Notes

- Pages Router, NOT App Router. Skip RSC `server-*` Vercel rules.
- `next.config.mjs` has `typescript.ignoreBuildErrors: true` — touched files still typecheck clean.
- Pre-existing TS errors in `scripts/seed-*`, `shadcn-space/blocks/pricing-02`, `ui/phone-input.tsx`, `lib/razorpayPersistence.ts` — out of scope.
