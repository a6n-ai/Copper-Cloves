# Optimization Audit — Copper & Cloves
_Generated 2026-06-28 · read-only audit, no code changed_

After deduplication the 79 raw findings collapse to ~45 distinct issues. Two themes dominate: (1) unbounded full-table booking scans on hot admin paths, and (2) systemic design-system drift — Playfair leaking into product UI, pure-white surfaces, amber alerts, and missing sage focus rings. Several findings are also genuine correctness/security bugs (truncated finance totals, `hashedPassword` shipped to the browser, fake persisted state), not just optimizations.

---

## TL;DR — top 10 highest-leverage fixes

| # | Fix | Lens | Severity | Effort | Files |
|---|---|---|---|---|---|
| 1 | Gate `pg` Pool config for serverless (finite `idleTimeoutMillis`, small `max`) — avoids RDS connection exhaustion on Vercel/Amplify | Perf | High | S | `src/lib/prisma.ts:152,161` |
| 2 | Batch the class-ledger per-package payment lookup (kill ≤500-query N+1) | Perf | High | S | `src/pages/api/admin/class-ledger.ts:62-79`, `src/lib/payments.ts:222-233` |
| 3 | Compute finance-ledger totals via `groupBy` over the full window, not the capped page (currently understates credit/debit/net) | Perf · correctness | High | S | `src/lib/financeLedger.ts:135,142` |
| 4 | Stop full-scanning all checked-in bookings to derive a top-1/top-8 streak leaderboard on every admin load | Perf | High | M | `src/lib/attendanceStats.ts:115,159`, `src/lib/adminDashboardSections.ts:480`, `src/pages/api/admin/control-analytics.ts:97` |
| 5 | Paginate `/api/admin/members` + switch `include`→`select` (stops shipping `hashedPassword`/questionnaire to the client) | Perf · security | High | M | `src/pages/api/admin/members.ts:16-22,88-108`, `prisma/schema.prisma:22` |
| 6 | Fix sage focus ring on auth inputs — base Input rings on `focus-visible:ring-1 ring-ring`, not the `focus:ring-sage` passed in | UI · a11y | High | S | `src/components/ui/input.tsx:11`, `src/components/auth/SignInForm.tsx:161,233` |
| 7 | Retheme FormAlert/Alert off banned amber/green/red onto warm Pill tokens (terracotta/sage/warm-red) | UI | High | S | `src/components/ui/form-alert.tsx:15-18`, `src/components/ui/alert.tsx:17,21` |
| 8 | Skip `/api/auth/session` fetch for anonymous marketing traffic (highest-volume segment) | Perf | Medium | M | `src/pages/_app.tsx:214-228` |
| 9 | Replace `bg-white` with `bg-white-warm` across admin finance inputs, dropdowns, sidebar (No-Pure-White rule) | UI | Medium | M | `src/components/dashboard/DashboardShell.tsx:56`, finance tabs, `phone-input.tsx`, `MemberSearch.tsx:304` |
| 10 | Give hand-rolled portal checkout/check-in modals real dialog semantics (focus trap, Esc, `aria-modal`) | UI · a11y | High | M | `src/pages/portal/packages.tsx:919-1100`, `src/pages/portal/dashboard.tsx:1039-1139` |

---

## Performance (Vercel / React)

### P1 — `pg` Pool never releases idle connections on serverless (outage risk)
`Pool` is created with `max:10, idleTimeoutMillis:0, keepAlive:true` — correct for the PM2 host, dangerous on Vercel/Amplify Lambda where each warm instance caches the global pool and holds up to 10 Postgres connections forever. Many warm instances × 10 connections can exceed RDS `max_connections` — a hard failure mode, not a slowdown.
**Fix:** detect `VERCEL`/`AWS_LAMBDA_FUNCTION_NAME`/`AWS_EXECUTION_ENV` and use `max: 1-3` + finite `idleTimeoutMillis` (10-30s) there; keep warm-forever only for PM2. Or front RDS with RDS Proxy/PgBouncer.
**Files:** `src/lib/prisma.ts:152,161`

### P2 — Unbounded full-table booking scans on hot admin paths (merged: 3 findings)
`computeAllUserStats()` runs `prisma.booking.findMany({ where:{ checked_in:true } })` with **no date filter and no limit**, loads every check-in row into Node, and groups/streaks in JS — just to return a top-1 or top-8 leaderboard + a 5-bucket histogram. It fires on every admin **overview** load (`getMemberStats` → `getStreakLeaderboardAndDistribution(1)`) and `/api/admin/control-analytics` (`getTopStreaks(8)`). `getDynamicStatsForUsers` repeats the same pattern (all check-ins for the whole member page, no bound), and `getMemberStats` then issues *yet another* per-user scan for member-of-month via `getDynamicStats(topBooker)` — a value the leaderboard pass already computed. Cost grows linearly and unbounded with attendance volume.
**Fix:** read precomputed `current_streak`/`longest_streak` from the existing `UserStats`/`UserStreak` models (recompute on check-in write only), or push the distribution + top-N into one SQL aggregate. At minimum bound the scan to ~60-90 days (streaks decay to 0 after a 1-day gap). Reuse the leaderboard's computed top-booker streak instead of re-querying, and fold `resolveMemberOfMonth` into the existing `Promise.all`.
**Files:** `src/lib/attendanceStats.ts:80-102,115-132,159`, `src/lib/adminDashboardSections.ts:388,396,480,512`, `src/pages/api/admin/control-analytics.ts:97`, `src/pages/api/admin/dashboard/member-stats.ts`

### P3 — class-ledger N+1 (up to 500 `payment.findFirst` per page load)
`addedRows = Promise.all(packages.map(... manualCreditExistsForPackage(up.id)))` issues one round-trip per package (take up to 500). `Promise.all` parallelizes but still saturates the pool and multiplies latency.
**Fix:** one batched `payment.findMany({ where:{ user_package_id:{ in: ids }, ... } })`, build a `Set`, map `movedToMoneyIn = set.has(up.id)` in memory.
**Files:** `src/pages/api/admin/class-ledger.ts:62-79`, `src/lib/payments.ts:222-233`

### P4 — `/api/admin/members` has no pagination and over-fetches every column (security)
`prisma.profile.findMany({ include: memberInclude })` with no `take/skip` returns **all** profiles, and because it uses `include` (not `select`) it ships every scalar — including `hashedPassword` (schema:22) and questionnaire — to the browser. Then `getDynamicStatsForUsers` runs an all-history scan over every member. Client paginates only after receiving the full set.
**Fix:** server-side pagination (cursor or take/skip + search), explicit `select` of display fields only (drop `hashedPassword`), scope stats to the current page.
**Files:** `src/pages/api/admin/members.ts:16-22,88-108`, `prisma/schema.prisma:22`

### P5 — Finance-ledger totals computed only over the capped page (money correctness)
`getFinanceLedger` fetches `limit+1`, slices to `limit`, then sums credit/debit/net over the **returned** rows. When `truncated=true` the admin sees totals for only the newest ~250 payments — silently wrong despite the flag.
**Fix:** compute totals with a separate `groupBy`/aggregate over the same `where` window, independent of the row page.
**Files:** `src/lib/financeLedger.ts:135,142`

### P6 — SSR gate returns zero data → guaranteed client waterfall
`requireSessionSSP` runs `getServerSideProps` only to resolve/redirect the session, returning `{ session }` and no page data. The SSR response is already dynamic (non-cacheable, blocks TTFB) but carries nothing above-the-fold; the browser must hydrate and fire `useEffect` fetches before any real data paints — a fixed extra round-trip on every member/admin/partner/instructor page.
**Fix:** extend `requireSessionSSP` (or a per-page wrapper) to fetch the primary slice server-side with the resolved session and seed client state from props; let `useEffect`/SWR only revalidate.
**Files:** `src/lib/requireSessionSSP.ts:27-53`, `src/pages/portal/dashboard.tsx:88`, `src/pages/admin/dashboard.tsx:65`, `src/pages/portal/book.tsx:6`, `src/pages/admin/finances.tsx:5`

### P7 — portal/dashboard pulls 500 bookings client-side, uncached, every mount (merged: 2 findings)
`fetchUserData` fires `/api/bookings?limit=500` to derive only 3 upcoming + ~15 recent + on-time/late/no-show tallies + a 30-day series — payload scales with lifetime booking count. All four mount fetches (user-stats, user-packages, cafe/orders, bookings?limit=500) use raw `fetch` in a `useEffect`, so they re-issue on every remount instead of hitting the 15s `useStudioSWR` dedupe used elsewhere.
**Fix:** purpose-built aggregate endpoint returning upcoming slice + counts + daily buckets; route the four fetches through `useStudioSWR`. Combine with P6 to seed first paint.
**Files:** `src/pages/portal/dashboard.tsx:382-396,460-503`

### P8 — `/api/admin/overview` fetched twice per dashboard session
The Overview effect and the Finance tab (`useAdminFinanceData` → `monthRevenue`) both raw-`fetch` `/api/admin/overview`, bypassing the 15s SWR dedupe, so the revenue-aggregating query runs twice.
**Fix:** route both through `useStudioSWR('/api/admin/overview')`, or thread `overviewStats.monthRevenue` into the finance hook.
**Files:** `src/pages/admin/dashboard.tsx:439`, `src/hooks/useAdminFinanceData.ts:137-142,208-210`

### P9 — Public components use full `motion`, defeating the app-wide `LazyMotion` split
`_app` correctly uses `LazyMotion` + `m`, but `PricingCard` (public /classes + packages), `/story`, and `AuthExperience` (/login) import full `motion.*`, pulling framer-motion's entire feature graph (~30KB+ gzip) into these high-intent public bundles. `optimizePackageImports` tree-shakes named exports but not the motion feature graph — only `LazyMotion` shrinks it.
**Fix:** convert to `import { m }` and `m.*` under the existing app-level `LazyMotion`.
**Files:** `src/components/pricing/PricingCard.tsx:1`, `src/pages/story.tsx:2`, `src/components/auth/AuthExperience.tsx:2`

### P10 — `SessionProvider` fires `/api/auth/session` for every anonymous marketing visitor
Static public pages have no `session` prop, so NextAuth fires a client `/api/auth/session` fetch on mount (a Lambda invocation returning null) and re-fires on every tab focus — on the highest-traffic, no-session segment.
**Fix:** branch on `isPublicSite(router.pathname)` to skip the provider/fetch (or set `refetchInterval={0}`/`refetchOnWindowFocus={false}`) for public routes; keep the 4-min refetch on authed portals.
**Files:** `src/pages/_app.tsx:214-228`

### P11 — `classes.tsx` hero is a raw unoptimized `<img>` (LCP)
Above-the-fold hero uses raw `<img src={cdnUrl('/warriorrythm.jpg')}>` (eslint-disabled) — no srcset, no width/height (CLS), no blur-up, full-res on mobile — while every other marketing hero uses `next/image`.
**Fix:** `next/image` with `fill`, `sizes`, `priority`, blur placeholder, matching pricing/story/rental heroes.
**Files:** `src/pages/classes.tsx:397-403`

### P12 — `cafe.tsx` hero mounts multiple autoplaying videos at once
The left split maps the whole `heroMedia` array and renders an `autoPlay <video>` for **every** entry (only opacity toggled), so both HD `.mp4`s decode continuously; the right split correctly mounts only the visible element. Wasted decode/bandwidth/battery on a non-LCP decorative hero.
**Fix:** mirror the right-side approach — mount the active media element only; add `preload="none"`/poster.
**Files:** `src/pages/cafe.tsx:149-191`

### P13 — Lower-impact perf cleanups
- **bookings GET over-fetches** full `class_model` + `instructor` (incl. payout fields `studio_payout_cut_percent`/`rate_*_paise`) via nested `include:true` to a member client — switch to explicit `select`. `src/pages/api/bookings.ts:59-66`
- **Cancellation refund grants** `userPackage.create` in a loop inside the open transaction — use `createMany`. `src/lib/classCancellation.ts:92`
- **Dead client auth redirect** in SSR-gated `portal/book` targets legacy `/portal/login` (double 307 if it fired) and forces a `useSession()` subscription — delete the branch. `src/pages/portal/book.tsx:827-837`
- **Legacy `/portal/login` CTAs** add an extra 307 hop (and may drop the `?redirect=` chain) — point at `/login`. `src/components/Footer.tsx:45`, `src/components/Pricing.tsx:20`, `src/pages/pricing.tsx:56`, `src/pages/classes.tsx:304,314,323`
- **Trim font weights:** Playfair loads 12 faces but `font-black`/`font-extrabold` (800/900) have no matches; Montserrat 300 used 3×. Trim arrays after grepping each weight. `src/pages/_app.tsx:11-24`

---

## UI/UX & Design System

### U1 — Playfair leaks into product UI (Strict Handoff Rule) — merged: 5 findings
design.md §3 forbids Playfair Display in portal/admin UI text (table cells, labels, nav, row titles). Violations across the portal/admin chrome:
- Member-detail data value: `font-display ... tabular-nums` — `src/pages/admin/members/[id].tsx:1131`
- Partner table cell (session count) — `src/pages/partner/members.tsx:120`
- Portal data cells/row titles/tiles — `OrderHistoryTable.tsx:87`, `UpcomingScheduleCard.tsx:89`, `mobile/PeekTile.tsx:28`, `mobile/MemberMobileDashboard.tsx:199`
- Portal **card headings** (`Movement Vitality`, `Recent Activity`, `Upcoming`, `Path to Mastery`) — `VitalityAreaChart.tsx:54`, `ActivityTimeline.tsx:30`, `UpcomingScheduleCard.tsx:59`, `MedalJourney.tsx:116`
- Avatar initials, `#1` rank micro-label — `admin/ListAvatar.tsx:49`, `admin/ControlAnalyticsPanel.tsx:440`, `portal/FriendsCard.tsx:44`

**Fix:** `font-body` (Montserrat) `font-semibold`/`font-medium` (+ `tabular-nums` on numeric cells); reserve Playfair for hero/section moments only. ~280 `font-display` uses exist in portal/admin — prioritize the small-size data/label cases.

### U2 — Banned amber + raw green/red in alert components (merged: 3 findings)
`FormAlert` and shadcn `Alert` style warning as `amber-300/50/800` and success/error as raw `green-*`/`red-*`. design.md bans amber/yellow and mandates warning=terracotta, success=sage, danger=warm-red `#cf5b48`. These render on member-facing surfaces (packages, onboarding, signup), directly contradicting the warm system and diverging from the canonical Pill tone tokens.
**Fix:** map variants to the Pill tone vars (`--pill-warning/success/danger-*`) so alerts and pills stay in sync, including dark mode.
**Files:** `src/components/ui/form-alert.tsx:15-18`, `src/components/ui/alert.tsx:17,21`

### U3 — Pure `#ffffff` surfaces violate No-Pure-White rule (merged: 4 findings)
27 surfaces use raw `bg-white`, concentrated on admin finance inputs/selects/textareas and dropdowns/popovers. The **sidebar** — a large persistent surface — is also pure white (`--sidebar-background: 0 0% 100%`). Sibling tabs (FinanceTab, MembersTab) already use `bg-white-warm`, so this is internal inconsistency too.
**Fix:** `bg-white` → `bg-white-warm` (`#fafaf8`); set `--sidebar-background` to `40 33% 98%`; change shared Input/Select/Popover/Command defaults so fields inherit white-warm. For `quick-actions` swap `hover:text-white!` → `hover:text-white-warm!`.
**Files:** `src/components/dashboard/DashboardShell.tsx:56`, `src/components/admin/dashboard-tabs/{ReconcileSection,PaymentsInSection,ExpensesSection,InstructorPayoutsPanel}.tsx`, `src/components/ui/phone-input.tsx:87-88`, `src/components/portal/MemberSearch.tsx:304`, `src/components/ui/shine-border.tsx:41`, `src/components/ui/quick-actions.tsx:85`

### U4 — Status/category chips bypass the canonical Pill (merged: 3 findings)
- Marketing eyebrow/category/status chips are hand-rolled `rounded-full` spans re-deriving tones inline; `shop.tsx:369` already uses `<Pill>`, so the codebase is inconsistent. `cafe.tsx:265,465,684,735,786,837`, `shop.tsx:259-262`, `Boutique.tsx:121-125`
- `TodayClassesCarousel` re-derives `STATUS_TONE` locally: cancelled/abandoned render terracotta `warning` instead of warm-red `danger`, completed renders neutral instead of slate-blue `info` — contradicting `classStatusPill`. `TodayClassesCarousel.tsx:50-58`
- The high-attention `Up next` marker is an inline `rounded-full bg-accent/15` pill. `TodayClassesCarousel.tsx:191-196`

**Fix:** route true category/status labels through `<Pill>` + `src/lib/pillMaps.ts` (`classStatusPill`). Marketing eyebrow pills may stay as a deliberate idiom.

### U5 — `set-password.tsx` is wholesale off the design system
Predates AuthShell: raw hex (`#f5f2ea/#333333/#6b6b6b/#8f9779/#e8e4d9`), `font-serif` heading (bypasses Strict Handoff), plain `<Input type=password>` (no show/hide, no sage focus), a `bg-white text-white` button (pure white), no AuthShell/leaves background/spinner. Looks like a different product from `/login`. Validation is also a post-submit destructive toast, not inline.
**Fix:** rewrite inside AuthShell, reusing `ResetPasswordForm` almost verbatim (PasswordInput ×2, `font-display` heading, sage Button + Spinner, token-validation/invalid-link states, palette tokens). Point `/57/login` directly at `/login` (it currently double-hops via `/partner/login`).
**Files:** `src/pages/portal/set-password.tsx:73-138`, `src/pages/57/login.tsx:9`

### U6 — Hand-rolled portal modals lack dialog semantics
Packages checkout overlay and dashboard check-in modal are custom `fixed inset-0` divs — no `role="dialog"`/`aria-modal`, no focus trap, no Esc, no backdrop click-to-close. conventions.md mandates `ResponsiveDialog`.
**Fix:** wrap in `ResponsiveDialog`/`ResponsiveDialogContent` (gets focus trap + Esc + aria for free), or at minimum add `role="dialog" aria-modal`, Esc handler, backdrop `onClick`, initial focus.
**Files:** `src/pages/portal/packages.tsx:919-1100`, `src/pages/portal/dashboard.tsx:1039-1139`

### U7 — Fake/ephemeral state erodes trust (Real-over-polished)
- **Today's Intention** is initialized to a hardcoded string; Edit/Save writes only to local React state (no GET/PATCH) — every reload silently discards the member's edit. `dashboard.tsx:289,705-733`
- **Notifications bell** hard-codes a terracotta unread dot regardless of state, with no handler. `DashboardShell.tsx:202`

**Fix:** persist the intention via the profile API (or downgrade to a static rotating prompt); drive the dot from real unread state (hide at zero) and add a focus ring.

### U8 — Missing loading/error/empty states (merged: 3 findings)
- **Pricing** (highest-conversion page): `usePublicPackages.isLoading` is ignored — blank grid under headings while SWR fetches or on DB hiccup. `classes.tsx`/`shop.tsx` ship skeletons. `pricing.tsx:84-104,186-190`, `Pricing.tsx:26-94`
- **Café menu**: SWR `error` never destructured — fetch failure falls through to "No café items available" empty copy, no retry. `portal/menu.tsx:52,171-178`
- **OrderHistoryTable**: empty `rows` renders a bare `<Table>` header with no body/message. `OrderHistoryTable.tsx:116`

**Fix:** consume `isLoading`/`error`; render skeletons during load, warm Alert+Retry (calling `mutate`) on error, designed empty states distinct from genuine-empty.

### U9 — Modals/cards break the elevation grammar (merged: shadow findings)
- Cafe crop modal uses banned `shadow-2xl` + `bg-black` (pure #000) cropper letterbox; CRM modals correctly use `shadow-[0_8px_48px_rgba(51,51,51,0.14)]`. `cafe.tsx:1559,1564`
- Auth card carries the **Deep** shadow (`0 8px 48px`) at rest — reserved for hero/image layers; UI surfaces are flat-at-rest with at most Lifted. `AuthShell.tsx:48`
- Skeletons/tiles use resting `shadow-xs`/`shadow-lg`/`shadow-md` while real cards are `shadow-none border-[#e5e4dc]` → elevation pop on load. `skeletons.tsx:31,33,53,76,103`, `mobile/PeekTile.tsx:20`, `mobile/MemberMobileDashboard.tsx:135,190`

**Fix:** flat + warm border at rest, Lifted (`0 4px 24px rgba(51,51,51,0.08)`) on hover only; Deep value for the crop modal; cropper bg to `#333`; skeletons mirror real card treatment.

### U10 — Identical card grids on `cafe.tsx` (explicit Don't)
3-across menu cards + 4-across event cards — design.md explicitly prohibits identical icon/title/text grids "on any surface." The homepage Experience bento avoids this; cafe regresses. The 4 RSVP buttons also all point to the same URL.
**Fix:** break ≥1 grid into an asymmetric/editorial layout (vary spans like the pricing INCLUDED bento); give events distinct RSVP targets.
**Files:** `src/pages/cafe.tsx:473-515,652-868`

### U11 — Lower-impact design-system drift
- Homepage **ClassCatalog** cards are plain `<div cursor-pointer>` with no Link/onClick — look clickable, do nothing; duration/benefit only in a `group-hover` overlay (unreachable on touch/keyboard). Make each a real `<Link>`/dialog trigger; show meta by default `<md`. `ClassCatalog.tsx:116-152`
- **Footer "Book a Visit"** hardcodes auth-gated `/portal/book`, bouncing guests to a login wall on every marketing page (Hero already solves this). `Footer.tsx:132-138`
- **Milestone tiers** use raw hex `text-[#a05e38]`/`#7a4327` (no dark-mode token coverage) — map to terracotta/sage token variants. `dashboard.tsx:142-154`
- **Segmented controls** differ in shape (packages `rounded-full` vs bookings `rounded-lg`) — extract one shared component. `packages.tsx:712-733`, `bookings.tsx:532-550`
- **Two admin detail dialogs** use raw shadcn `Dialog` (no phone bottom-sheet) while the rest of admin uses `ResponsiveDialog`. `schedule/[id].tsx:858,936`, `instructors/[id].tsx:422`
- **Partners page** uses a full-page spinner (layout jump) vs skeletons everywhere else. `partners.tsx:116-121`
- **Mobile dashboard** stacks a full sage gradient hero directly above a full terracotta CTA — co-equal saturated fills violate the Two-Voice Rule. `mobile/MemberMobileDashboard.tsx:135,190,213`
- **Mobile bottom-nav** active state is terracotta vs sidebar sage — same nav role, two colors. `MobileBottomNav.tsx:61,130` vs `DashboardShell.tsx:147`
- **GlobalSearch** input is `rounded-full` vs the `rounded-md` input system. `GlobalSearch.tsx:124`
- Verify `--color-chart-1`/`--primary` resolve to sage (the only dashboard chart carries the brand burden). `VitalityAreaChart.tsx:50,66,87`
- **Dead code:** unused vendored `table-01` block ships `amber-300` + `blue-500` — delete or retheme. `shadcn-space/blocks/table-01/table.tsx:78,134`

---

## Accessibility & Responsive

### A1 — Sage focus ring is effectively absent across interactive elements (merged: focus-ring findings)
design.md mandates a 2px sage focus ring on **all** interactive elements, "never blue." Pervasively missing:
- **Auth inputs:** base `Input` rings via `focus-visible:ring-1 ring-ring` (muted default), so the `focus:ring-sage` passed in never renders sage; the ring is also 1px vs the spec'd 2px. `input.tsx:11`
- **Auth buttons:** portal picker, "different portal" link, password generator, waiver toggle — `hover:`-only, no focus ring. `SignInForm.tsx:182-188,217-221`, `SignUpForm.tsx:288-294,340-352`
- **Portal controls:** segmented toggles (packages/bookings), mobile quick-action tiles (desktop tiles correctly ring), schedule-row/Cancel buttons, PeekTile, next-class CTA, every `MobileBottomNav` link. `packages.tsx:713-732`, `bookings.tsx:538-558`, `dashboard.tsx:765-774`, `UpcomingScheduleCard.tsx:76,105`, `PeekTile.tsx:16`, `MobileBottomNav.tsx:73`
- **Admin controls:** SortableHeader button, carousel card (`role=button`), scroll arrows. `sortable-table.tsx:104-117`, `TodayClassesCarousel.tsx:161-180,322-340`
- **MedalJourney dots:** `focus:outline-none` with no replacement **and** a 24px tap target (below 44px min). `MedalJourney.tsx:184`

**Fix:** add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage` (+ ring-offset on tinted surfaces) everywhere; never strip `outline-none` without a sage replacement. Bump base Input to `ring-2`. Enlarge the MedalJourney hit area to ≥44px. Give the portal picker a radio-group role.

### A2 — `prefers-reduced-motion` not honored across many keyframe/loop animations (merged: reduced-motion findings)
design.md requires reduced-motion guards on all keyframe/continuous animation. Unguarded:
- **NumberTicker** — 1.2s rAF count-up on every MetricCard mount/refresh across all admin dashboards. `NumberTicker.tsx:31-48`
- **AnimatedIcon** — spring pop-in + hover, used 50+ times across the dashboard. `AnimatedIcon.tsx:18,42`
- **Auth** — card slide-up, mode cross-fade, height-auto reveals, signup `@keyframes progress`. `AuthShell.tsx:36-40`, `AuthExperience.tsx:30-35`, `SignInForm.tsx:168-176`, `SignUpForm.tsx:156-164`
- **Testimonial** carousel auto-rotate + 500ms fade (also no `aria-live`, no pause, uniformly effusive copy that "signals fabrication"). `Testimonial.tsx:47-57,75-89`
- **cafe menu-card** entrance `animate-in slide-in-from-bottom` (the one unguarded animation in that file). `cafe.tsx:479-481`
- **Admin** — pervasive `animate-pulse`/`animate-spin` (only `cafe.tsx:710` guards); `TodayClassesCarousel` `ShineBorder` shimmer + pulse dot. `admin/dashboard.tsx:81,84`, `schedule.tsx:281`, `TodayClassesCarousel.tsx:192-196,303-313`

**Fix:** `useReducedMotion()` to short-circuit JS animations (set final value, skip rAF/spring); a global `globals.css` `@media (prefers-reduced-motion: reduce)` override disabling `animate-pulse`/`animate-spin` and forcing `transition-duration:0.01ms`; `motion-reduce:` variants on entrance/shimmer/pulse. Add `aria-live="polite"` + pause to the testimonial region and soften 1-2 quotes.

### A3 — Auth errors not announced or associated
Validation/API errors are plain `<div>`/`<p>` with no `role="alert"`/`aria-live`, and inputs lack `aria-invalid`/`aria-describedby` — screen-reader users get no announcement on "Invalid email or password" or field errors. Errors also render three different ways (canonical `FormAlert` vs hand-rolled `bg-[#a05e38]/10` divs) using raw `#a05e38` brown, not the danger token `#cf5b48`.
**Fix:** `aria-live="polite"` (or `role=alert`) on error containers, `aria-invalid` + `aria-describedby` on fields; route all auth errors through `FormAlert` + a shared field-error component using the danger token; drop the `#a05e38` literal.
**Files:** `SignInForm.tsx:263-265`, `ResetPasswordForm.tsx:126-128`, `SignUpForm.tsx:212-214`

### A4 — Low-opacity charcoal text likely fails WCAG AA
`text-charcoal/40`–`/45` metadata (MedalJourney counter, "Tap the medal to flip", group labels) and `text-charcoal/50` (MetricCard label) over white-warm is ~2.3-2.8:1, below the 4.5:1 threshold. A dedicated `muted-text` (`#6b6b6b` ≈ 5.7:1) token exists.
**Fix:** replace sub-40% charcoal small text with `muted-text`; reserve <40% opacity for non-essential decoration.
**Files:** `MedalJourney.tsx:117,162`, `admin/MetricCard.tsx:121`, `DashboardShell.tsx:131`

### A5 — Non-responsive `grid-cols` + fixed widths on phone surfaces
Fixed `grid-cols-3`/`grid-cols-4` with no breakpoint prefix cramp on narrow phones (instructor stat tiles, mobile dashboard, vitality footer, activity log). The `TodayClassesCarousel` card is `w-[340px]` (≈full 360px viewport, no peek). (`grid-cols-7` week calendars are intentional.)
**Fix:** start 1-2 col and step up (`grid-cols-2 sm:grid-cols-4`); `w-[85vw] max-w-[340px] sm:w-[340px]` on the carousel card.
**Files:** `instructor/dashboard.tsx:216`, `mobile/MemberMobileDashboard.tsx:257`, `VitalityAreaChart.tsx:94`, `activity/ActivityLogList.tsx:120`, `TodayClassesCarousel.tsx:175`

---

## Quick wins (≤30 min each)

- Gate the `pg` Pool for serverless runtimes — `prisma.ts:152,161` (**P1, outage risk**)
- Batch the class-ledger payment lookup into one `findMany` — `class-ledger.ts:62-79` (**P3**)
- Compute finance totals via a separate aggregate — `financeLedger.ts:135,142` (**P5, money correctness**)
- Bump base Input to `focus-visible:ring-2 ring-sage` so the brand focus ring actually renders — `input.tsx:11` (**A1**)
- Retheme FormAlert/Alert off amber/green/red onto Pill tokens — `form-alert.tsx:15-18`, `alert.tsx:17,21` (**U2**)
- `bg-white` → `bg-white-warm` on finance inputs, dropdowns, sidebar — (**U3**)
- Drop `font-display` from the clear data-cell/label leaks — `members/[id].tsx:1131`, `partner/members.tsx:120`, `OrderHistoryTable.tsx:87` (**U1**)
- Point legacy `/portal/login` and `/57/login` CTAs at `/login`; delete the dead redirect in `portal/book` — (**P13**)
- Café menu: destructure SWR `error` + add retry branch — `menu.tsx:52` (**U8**)
- `cafe.tsx` crop modal: `shadow-2xl`→Deep token, `bg-black`→`bg-[#333]` — `cafe.tsx:1559,1564` (**U9**)
- Add a global `prefers-reduced-motion` override in `globals.css` disabling `animate-pulse`/`animate-spin` (**A2**)
- Make `bookings` GET use explicit `select` (stop shipping instructor payout fields) — `bookings.ts:59-66`
- Swap `cafe.tsx` hero to mount only the active video; `classes.tsx` hero to `next/image` — (**P11/P12**)
- Delete the unused `shadcn-space/table-01` block carrying amber/blue (**U4 dead code**)
- `cancellation` refund: `userPackage.create` loop → `createMany` — `classCancellation.ts:92`
- Trim Playfair/Montserrat font weights after grep — `_app.tsx:11-24`

## Larger refactors

- **Replace per-request streak full-scans with denormalized `UserStats`/`UserStreak` reads (or SQL aggregates).** _Rationale:_ the single most scalability-sensitive code path — it runs on the hottest admin surfaces and grows linearly forever with attendance volume. Models to hold this already exist (known-issues #1); recompute on check-in write only. (**P2**)
- **Paginate + `select` the admin members endpoint.** _Rationale:_ correctness/security (stops shipping `hashedPassword`) and prevents linear degradation; also unblocks scoping `getDynamicStatsForUsers` to one page. (**P4**)
- **Move above-the-fold data into the SSR session gate and seed client state from props.** _Rationale:_ removes a guaranteed extra round-trip on every authed page's critical path; route the portal dashboard's four mount fetches through `useStudioSWR` while at it. (**P6/P7**)
- **Rebuild `set-password.tsx` on AuthShell/ResetPasswordForm.** _Rationale:_ it is the single page wholesale off the design system and the security-sensitive set-password flow looks like a different product; reusing ResetPasswordForm also inherits inline zod validation + a11y. (**U5**)
- **Extract shared primitives:** one segmented-control component, one field-error/alert component on Pill tokens, and a sage-focus-ring utility applied via the shared `Button`/`Input`. _Rationale:_ the focus-ring, amber-alert, and segmented-control drift are all symptoms of components re-implementing instead of inheriting — fixing the primitives closes dozens of per-page violations at once. (**U2/U4/A1**)
- **Convert public marketing animation to `LazyMotion` + skip the anonymous session fetch.** _Rationale:_ public pages are the bulk of first-load traffic; both reduce per-visitor Lambda cost and bundle weight on the conversion path. (**P9/P10**)
- **Break the `cafe.tsx` identical card grids into editorial layouts.** _Rationale:_ explicit design.md prohibition on a high-traffic marketing surface; needs real layout work, not a token swap. (**U10**)