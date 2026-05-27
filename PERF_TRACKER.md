# Perf Tracker

Vercel React rules audit + remediation. Tracks all findings from initial scan + rescan.

Legend: `[x]` done · `[ ]` pending · `[~]` in progress · `[-]` deferred (needs discussion)

## Bundle (CRITICAL)

- [x] `admin/dashboard.tsx` — recharts (11 components) wrapped in `next/dynamic({ssr:false})`
- [x] `admin/control.tsx` — `ControlAnalyticsPanel` (~700 lines) dynamic
- [ ] `admin/schedule/[id].tsx` L730,806 — edit/status Dialogs dynamic
- [x] `components/checkin/CheckInScanButton.tsx` — `ScanCheckInModal` (camera/jsqr) via `next/dynamic({ssr:false})`; only mounts when `open=true`
- [x] `portal/book.tsx` — razorpay helpers (`payWithRazorpayOrder`, `razorpayPaymentErrorHelp`, `completePendingBookingCheckout`, `completePendingPackageCheckout`) all migrated to dynamic `import()` inside handlers
- [x] `portal/packages.tsx` — same razorpay helpers dynamic
- [ ] `admin/schedule/[id].tsx` L730,806 — edit/status Dialogs dynamic

## Scroll / event listeners

- [x] `pages/cafe.tsx` — scroll listener rAF-throttled; `getBackgroundColor` pure module fn
- [x] `components/Instructors.tsx` — scroll listener now rAF-throttled + DOM-ref mutation; was setState-per-pixel re-rendering the whole instructor list
- [ ] `components/Navigation.tsx` L26-30 — compare-and-skip OK; throttle via rAF for safety

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
- [ ] `portal/bookings.tsx` L198 — `sortedBookings`, `paginatedBookings`
- [~] `portal/dashboard.tsx` — `activeMilestones` `useMemo` done; `currentMilestone` + `nextMilestone` combined into single `useMemo` (was two scans per render). `statItems`/`upcomingEntries`/`orderRows` still TODO.
- [ ] `pages/classes.tsx` L451-456 — `activeTab` effect+setState → derive from query

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
- [ ] `pages/admin/members.tsx` (eslint-disable masks — low impact, keep as-is)
- [ ] `pages/cafe.tsx` (post-hoist — no `session` deps left, low impact)
- [ ] `pages/classes.tsx` L11,452
- [ ] `pages/cafe/meal-subscription.tsx`

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
- [ ] `portal/book.tsx` L1012,1502 — `BookClassCard`, `FoodRow` memo
- [ ] `portal/bookings.tsx` L247,322 — merge mobile-card + desktop-table dual render
- [ ] `portal/dashboard.tsx` L548-553 — memo action-button array

## Iteration hotspots (`js-index-maps`, `js-combine-iterations`)

- [ ] `admin/CRM.tsx` L775,898 — Map for `templateTypes`, `triggerTypes`
- [ ] `admin/schedule.tsx` L611,621,628,882-897,1324 — class/instructor Map
- [ ] `admin/control.tsx` L656 — users Map
- [ ] `admin/products.tsx` L557 — category Map
- [ ] `admin/cafe.tsx` L812 — category Map
- [ ] `admin/schedule/[id].tsx` L416-419 — two passes → one reduce
- [x] `admin/kitchen/index.tsx` — three filter scans collapsed into one `useMemo` pass producing `{active, pendingCount, completedToday}`
- [ ] `portal/dashboard.tsx` L201,312,346 — chained filter/sort/map
- [ ] `portal/menu.tsx` L338 — categories.find per item
- [ ] `instructor/dashboard.tsx` L127,295-302,217-221 — classes.find + reduce
- [ ] `portal/book.tsx` L240-250 — Date per compare; precompute startMs
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

## Notes

- Pages Router, NOT App Router. Skip RSC `server-*` Vercel rules.
- `next.config.mjs` has `typescript.ignoreBuildErrors: true` — touched files still typecheck clean.
- Pre-existing TS errors in `scripts/seed-*`, `shadcn-space/blocks/pricing-02`, `ui/phone-input.tsx`, `lib/razorpayPersistence.ts` — out of scope.
