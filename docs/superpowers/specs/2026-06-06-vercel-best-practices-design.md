# Vercel Best Practices Optimization — Design Spec

**Date:** 2026-06-06  
**Project:** Copper & Cloves (Next.js 15, Pages Router)  
**Scope:** Vercel deployment optimization — 8 independent tasks, implemented via parallel sub-agents  
**Constraint:** Preserve Amplify compatibility where possible (dual-deploy target)

---

## Background

Audit of the codebase against Vercel/Next.js best practices found 8 issues ranging from critical security exposures to medium performance gaps. Tasks are independent — no shared state, no ordering dependency — making them ideal for parallel sub-agent execution.

---

## Task Inventory

### T1 — Remove `public/_originals` (🔴 Critical)

**Problem:** `public/_originals/` contains 500MB of raw source images committed to the repo. Vercel enforces a ~250MB repo size limit; this folder alone blows it. Even on Amplify it bloats build artifacts and CI times.

**Fix:** Add `public/_originals/` to `.gitignore`. Verify nothing in the app references paths under `_originals` at runtime (they are source files, not served assets — confirmed by audit). Remove the folder from git tracking via `git rm -r --cached public/_originals`.

**Out of scope:** Migrating the images to S3 (separate infrastructure task). The folder stays on disk locally; just stops being tracked.

**Risk:** None — these are original source files, not served URLs. The optimized copies already exist in `public/food/`, `public/events/`, etc.

---

### T2 — Fix `inlineEnv` Secret Exposure in `next.config.mjs` (🔴 Critical)

**Problem:** `next.config.mjs` bakes all server-side secrets (`DATABASE_URL`, `RAZORPAY_KEY_SECRET`, `S3_SECRET_ACCESS_KEY`, `NEXTAUTH_SECRET`, etc.) into the Next.js bundle via the `env` block. This was added to work around Amplify Hosting's SSR Lambda not injecting Console env vars at runtime. On Vercel, runtime env vars work natively — no inlining needed.

**Fix strategy — dual-platform guard:**  
Detect deployment target via env var and only inline on Amplify:

```js
const IS_AMPLIFY = Boolean(process.env.AWS_APP_ID || process.env.AWS_BRANCH);

const nextConfig = {
  env: IS_AMPLIFY ? inlineEnv : {},
  // ...
};
```

This keeps Amplify deploys working unchanged while Vercel gets clean runtime injection. The `inlineEnv` object stays in the file but is only applied when `AWS_APP_ID` (set automatically by Amplify) is present.

**Risk:** Vercel env vars must be configured in the Vercel dashboard (Project Settings → Environment Variables) before deploying. Document in `DEPLOY.md`.

---

### T3 — Fix `next/font` Placement (🟠 High)

**Problem:** `Playfair_Display` and `Montserrat` are imported from `next/font/google` inside `_document.tsx`. This is incorrect — `next/font` must be used in `_app.tsx` or a layout component. In `_document.tsx` the font CSS variables are never applied to the DOM and self-hosting does not activate, meaning fonts still load from Google CDN (privacy + perf regression).

**Fix:** Move font declarations to `_app.tsx`. Apply the `.className` or `.variable` to the `<body>` via the `Component` wrapper. Remove the import from `_document.tsx`.

**Pattern:**
```tsx
// _app.tsx
import { Playfair_Display, Montserrat } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });

export default function App({ Component, pageProps }) {
  return (
    <main className={`${playfair.variable} ${montserrat.variable}`}>
      <Component {...pageProps} />
    </main>
  );
}
```

Tailwind config already uses `--font-playfair` / `--font-montserrat` CSS variables — this wires them up correctly.

**Risk:** Visual diff possible if fonts were silently falling back to system fonts. Preview in dev before shipping.

---

### T4 — API Route Caching (🟠 High)

**Problem:** Read-heavy public/semi-public API routes make a full DB round-trip on every request with no caching. Vercel's CDN can cache `GET` responses when `Cache-Control` headers are present.

**Eligible routes (read-only, low-churn data):**

| Route | TTL | Rationale |
|---|---|---|
| `GET /api/packages` | 60s SWR | Package catalog rarely changes |
| `GET /api/retail-products` | 60s SWR | Product catalog |
| `GET /api/classes` | 120s SWR | Class type templates |
| `GET /api/class-schedules` | 30s SWR | Schedule list (more volatile) |
| `GET /api/cafe/items` | 120s SWR | Café menu |

**Pattern** (add to each eligible GET handler):
```ts
res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
```

**Excluded routes:** Any route touching auth session, bookings mutation, payments, admin write ops — these must stay `no-store`.

**Risk:** Stale data window. Kept short (30–120s) to balance perf vs. freshness. Admin-triggered changes that need instant propagation (e.g., cancelling a class) should call a revalidation endpoint or accept the SWR window.

---

### T5 — Replace Raw `<img>` Tags with `next/image` (🟡 Medium)

**Problem:** 8 `<img>` tags bypass Next.js Image Optimization — no AVIF/WebP conversion, no lazy loading, no `srcSet`, no CDN caching of optimized variants.

**Fix:** Audit each `<img>` tag, replace with `<Image>` from `next/image`. For tags with dynamic/external sources, ensure the hostname is in `next.config.mjs` `remotePatterns` (already has `**.amazonaws.com`, `**.cloudfront.net`, `images.unsplash.com`).

**For each replacement:**
- Add `width` + `height` props (or use `fill` with a positioned container)
- Add `alt` (accessibility, already required by lint)
- Add `priority` for above-the-fold images

**Risk:** Layout shift if dimensions are wrong. Test visually after each replacement.

---

### T6 — Add `vercel.json` (🟡 Medium)

**Problem:** No `vercel.json` means:
- Heavy API routes (webhook, payouts) run with default 10s timeout — too short
- Static assets (`/public/*`) get no explicit long-lived cache headers at CDN edge
- No function memory config for DB-heavy routes

**Design:**
```json
{
  "functions": {
    "src/pages/api/payments/razorpay/webhook.ts": {
      "maxDuration": 30
    },
    "src/pages/api/admin/instructor-payouts.ts": {
      "maxDuration": 30
    },
    "src/pages/api/admin/dashboard/transactions.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/fonts/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/(.*\\.(?:ico|svg|png|jpg|jpeg|webp|avif|mp4|woff2?))",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

**Risk:** `maxDuration` on Vercel Hobby plan is capped at 10s — only Pro/Enterprise can set 30s. Spec should document the plan requirement.

---

### T7 — Dynamic Imports for Heavy Admin Pages (🟡 Medium)

**Problem:** The three heaviest admin pages load all components eagerly on first paint:
- `admin/control.tsx` — 2783 lines, includes `ControlAnalyticsPanel` (recharts heavy)
- `admin/dashboard.tsx` — 2218 lines, includes multiple chart tabs
- `admin/CRM.tsx` — 1679 lines, includes email template editor

**Fix:** Wrap heavy below-the-fold components in `dynamic(() => import(...), { ssr: false })`:
- `ControlAnalyticsPanel` (recharts — large)
- Dashboard chart tabs (`FinanceTab`, `InstructorPayoutsPanel`)
- CRM template editor panel

**Pattern:**
```tsx
const ControlAnalyticsPanel = dynamic(
  () => import("@/components/admin/ControlAnalyticsPanel"),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> }
);
```

**Risk:** SSR content shifts to CSR — fine for authenticated admin routes (not SEO-sensitive). Loading skeleton prevents layout flash.

---

### T8 — Convert Static Public Pages from SSR to SSG + ISR (🟡 Medium)

**Problem:** Pages with fully static content use `getServerSideProps` — hitting the server on every page view unnecessarily:
- `founder.tsx` — editorial, rarely changes
- `pricing.tsx` — pricing page
- `policy.tsx` / `terms.tsx` — legal docs
- `rental.tsx` / `meal-subscription.tsx` — marketing pages

**Fix:** Convert to `getStaticProps` with ISR revalidation:
```ts
export const getStaticProps = async () => ({
  props: {},
  revalidate: 3600, // 1 hour
});
```

Pages with NO data fetching at all (policy, terms) → remove the function entirely (default static).

**Risk:** If any of these pages currently read from session in `getServerSideProps` (e.g., to redirect authenticated users), that logic must move to client-side `useEffect` or middleware. Audit each page before converting.

---

## Implementation Approach

Each task is independent. Implement via parallel sub-agents — one sub-agent per task in a new session. Each agent gets: this spec, the relevant file paths, and explicit "do not touch files outside your task scope."

**Suggested agent grouping for parallel execution:**

| Wave | Tasks | Reason |
|---|---|---|
| Wave 1 (parallel) | T1, T2, T3 | No file overlap; critical/high severity first |
| Wave 2 (parallel) | T4, T5, T6 | Medium; T5 depends on knowing T6's remotePatterns (same file) — coordinate or do T6 first |
| Wave 3 (parallel) | T7, T8 | Larger page edits; lower risk |

---

## Success Criteria

- [ ] `public/_originals` removed from git tracking; `.gitignore` updated
- [ ] `next.config.mjs` `inlineEnv` only applied on Amplify (`AWS_APP_ID` guard)
- [ ] Fonts self-hosted via `next/font` in `_app.tsx`; no Google Fonts CDN requests
- [ ] 5 read-heavy API routes have `Cache-Control: s-maxage` headers
- [ ] All 8 raw `<img>` tags replaced with `next/image`
- [ ] `vercel.json` present with function timeouts + static asset cache headers
- [ ] 3 heavy admin components lazy-loaded via `dynamic()`
- [ ] 4+ static public pages converted to `getStaticProps` / pure static

---

## Files Touched Per Task

| Task | Primary Files |
|---|---|
| T1 | `.gitignore` |
| T2 | `next.config.mjs`, `DEPLOY.md` |
| T3 | `src/pages/_document.tsx`, `src/pages/_app.tsx` |
| T4 | `src/pages/api/packages.ts`, `api/retail-products.ts`, `api/classes.ts`, `api/class-schedules.ts`, `api/cafe/*` |
| T5 | Any `src/` file containing `<img ` tag |
| T6 | `vercel.json` (new file) |
| T7 | `src/pages/admin/control.tsx`, `admin/dashboard.tsx`, `admin/CRM.tsx` |
| T8 | `src/pages/founder.tsx`, `pricing.tsx`, `policy.tsx`, `terms.tsx`, `rental.tsx`, `meal-subscription.tsx` |
