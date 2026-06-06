# Vercel Best Practices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 real Vercel/Next.js best-practice gaps: secret leakage via inlineEnv, 8 unoptimized `<img>` tags, missing `vercel.json`, and a redundant SSR redirect.

**Architecture:** 4 independent tasks with zero file overlap — run in parallel via sub-agents. Each task is a targeted surgical edit; no refactoring of surrounding code.

**Tech Stack:** Next.js 15 (Pages Router), TypeScript, `next/image`, Vercel deployment

**Audit note:** T1 (`public/_originals`), T3 (next/font), T4 (API caching), and T7 (dynamic imports) were found already correctly implemented — excluded from this plan.

---

## Task 1: Fix `inlineEnv` Secret Exposure (`next.config.mjs`)

**Files:**
- Modify: `next.config.mjs`
- Modify: `DEPLOY.md`

**Problem:** The `env: inlineEnv` block bakes all server secrets (DB URL, Razorpay key secret, S3 secret key, NextAuth secret) into the Next.js bundle. Every browser that loads the app can read these in DevTools → Sources. This was an Amplify workaround — Vercel injects env vars at runtime natively.

**Fix:** Guard `inlineEnv` so it only applies when running on Amplify (`AWS_APP_ID` is auto-set by Amplify's build environment).

- [ ] **Step 1: Read the current next.config.mjs env block**

Open `next.config.mjs` and find this section (around line 55):
```js
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: inlineEnv,
```

- [ ] **Step 2: Add the Amplify guard**

Add the guard constant after the `inlineEnv` object definition (before `const nextConfig`), then update the `env` key:

```js
// Only inline secrets on Amplify — Amplify SSR Lambdas don't get Console env
// vars injected at runtime, so we bake them in at build time. On Vercel and
// local dev, runtime env works correctly; inlining is a security liability.
const IS_AMPLIFY = Boolean(process.env.AWS_APP_ID || process.env.AWS_BRANCH);

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: IS_AMPLIFY ? inlineEnv : {},
```

The `inlineEnv` object itself stays unchanged — it's still needed for Amplify deploys.

- [ ] **Step 3: Verify the change builds without error**

```bash
npm run build
```

Expected: build completes. If it fails with a missing env error on Vercel-like environments, the guard is working correctly — those vars are now sourced from the Vercel dashboard at runtime.

- [ ] **Step 4: Document the Vercel env requirement in DEPLOY.md**

Append this section to `DEPLOY.md`:

```markdown
## Vercel Deployment

Unlike Amplify, Vercel injects environment variables at runtime — no build-time inlining needed.

**Required:** Configure all vars from `.env.example` in the Vercel dashboard under
Project Settings → Environment Variables before the first deploy.

Key vars that MUST be set:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (set to your production domain, e.g. `https://yourdomain.com`)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_REGION`
- `CRON_SECRET`

`NEXT_PUBLIC_BUILD_ID` is optional — Vercel auto-sets `VERCEL_GIT_COMMIT_SHA`
which `next.config.mjs` already uses as a fallback.
```

- [ ] **Step 5: Commit**

```bash
git add next.config.mjs DEPLOY.md
git commit -m "fix: guard inlineEnv to Amplify-only; Vercel uses runtime env injection"
```

---

## Task 2: Replace 8 Raw `<img>` Tags with `next/image`

**Files:**
- Modify: `src/components/Hero.tsx`
- Modify: `src/pages/portal/book.tsx`
- Modify: `src/pages/admin/instructors/[id].tsx`
- Modify: `src/components/classes/ClassDetailDialog.tsx`

**Why:** Raw `<img>` tags bypass Next.js Image Optimization — no AVIF/WebP conversion, no lazy loading, no `srcSet`, no CDN-cached optimised variants. ESLint already flags these with `@next/next/no-img-element` (suppressed with `// eslint-disable-next-line` comments).

All dynamic image sources are CloudFront/S3 URLs (`**.cloudfront.net`, `**.amazonaws.com`) already in `next.config.mjs` `remotePatterns`, or local `/` paths (no pattern needed).

---

### 2a — `src/components/Hero.tsx` (4 instances)

All 4 are `aria-hidden` video poster fallbacks in fill-mode containers.

- [ ] **Step 1: Add Image import if not already present**

Check the top of `Hero.tsx` for `import Image from "next/image"`. If absent, add it after the React import:
```tsx
import Image from "next/image";
```

- [ ] **Step 2: Replace the 3 carousel poster `<img>` tags**

There are 3 instances of `<img src={poster} alt="" aria-hidden className="h-full w-full object-cover" />` and 1 with an extra `${panel.anim}` class. Find the parent `<div>` for each — it already has `className` containing absolute positioning. Each `<img>` that fills its container gets `fill` + `sizes="100vw"`.

**Instance 1** (inactive carousel frame, around line 89):
```tsx
// Before:
<img src={poster} alt="" aria-hidden className="h-full w-full object-cover" />

// After:
<Image src={poster} alt="" aria-hidden fill sizes="100vw" className="object-cover" />
```

**Instance 2** (single panel video fallback, around line 122):
```tsx
// Before:
mediaEl = <img src={poster} alt="" aria-hidden className="h-full w-full object-cover" />;

// After:
mediaEl = <Image src={poster} alt="" aria-hidden fill sizes="100vw" className="object-cover" />;
```

**Instance 3** (Connect panel static fallback, around line 168):
```tsx
// Before:
<img src={cdnUrl("/Connect-1.poster.jpg")} alt="" aria-hidden className="h-full w-full object-cover" />

// After:
<Image src={cdnUrl("/Connect-1.poster.jpg")} alt="" aria-hidden fill sizes="100vw" className="object-cover" />
```

**Instance 4** (multi-panel carousel, around line 292 — has animation class):
```tsx
// Before:
<img src={poster} alt="" aria-hidden className={`h-full w-full object-cover ${panel.anim}`} />

// After:
<Image src={poster} alt="" aria-hidden fill sizes="100vw" className={`object-cover ${panel.anim}`} />
```

- [ ] **Step 3: Verify parent containers have `position: relative`**

`<Image fill>` requires a positioned parent. Check each parent `<div>` around the replaced tags. They use `absolute inset-0` or `relative` — both provide a positioning context. If any parent lacks positioning, add `relative` to its className.

- [ ] **Step 4: Remove the eslint-disable-next-line comments** above each replaced tag.

- [ ] **Step 5: Commit Hero.tsx**

```bash
git add src/components/Hero.tsx
git commit -m "fix(hero): replace aria-hidden video poster img tags with next/image"
```

---

### 2b — `src/pages/portal/book.tsx` (2 instances)

- [ ] **Step 1: Add Image import**

Add at the top of the file (check if already present first):
```tsx
import Image from "next/image";
```

- [ ] **Step 2: Replace instructor avatar (around line 327)**

The avatar is inside a circular `overflow-hidden` div. The `<img>` fills it 100%.

```tsx
// Before (inside the InstructorAvatar component):
<img src={imageUrl} alt={name} className="h-full w-full object-cover" />

// After:
<Image src={imageUrl} alt={name} fill sizes="64px" className="object-cover" />
```

The parent div already has `overflow-hidden rounded-full` — add `relative` to its className if not present:
```tsx
<div className={`relative shrink-0 overflow-hidden rounded-full border-2 border-white-warm/90 bg-linear-to-br from-terracotta/80 to-terracotta ${className}`}>
```

- [ ] **Step 3: Replace class card image (around line 504)**

Inside `<div className="relative h-44">` — parent already has `relative`.

```tsx
// Before:
<img src={cls.image} alt={cls.name} className="h-full w-full object-cover" />

// After:
<Image src={cls.image} alt={cls.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
```

- [ ] **Step 4: Remove the eslint-disable-next-line comments.**

- [ ] **Step 5: Commit**

```bash
git add src/pages/portal/book.tsx
git commit -m "fix(portal/book): replace img tags with next/image for instructor avatar and class card"
```

---

### 2c — `src/pages/admin/instructors/[id].tsx` (1 instance)

- [ ] **Step 1: Add Image import** (check if present first):
```tsx
import Image from "next/image";
```

- [ ] **Step 2: Replace the instructor avatar (around line 491)**

The `<img>` has `className="size-16 rounded-full object-cover ring-2 ring-sage/20 shrink-0"` — fixed 64×64px.

```tsx
// Before:
<img src={value} alt={name || "Instructor"} className="size-16 rounded-full object-cover ring-2 ring-sage/20 shrink-0" />

// After:
<Image src={value} alt={name || "Instructor"} width={64} height={64} className="size-16 rounded-full object-cover ring-2 ring-sage/20 shrink-0" />
```

Use explicit `width={64} height={64}` (not `fill`) — the image has a fixed intrinsic size, not a fill layout.

- [ ] **Step 3: Remove the eslint-disable-next-line comment.**

- [ ] **Step 4: Commit**

```bash
git add "src/pages/admin/instructors/[id].tsx"
git commit -m "fix(admin/instructors): replace img tag with next/image for instructor avatar"
```

---

### 2d — `src/components/classes/ClassDetailDialog.tsx` (1 instance)

- [ ] **Step 1: Add Image import** (check if present first):
```tsx
import Image from "next/image";
```

- [ ] **Step 2: Replace class image (around line 34)**

Inside `<div className="relative h-44">` — parent already has `relative`.

```tsx
// Before:
<img src={classItem.imageUrl} alt={classItem.name} className="h-full w-full object-cover" />

// After:
<Image src={classItem.imageUrl} alt={classItem.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
```

- [ ] **Step 3: Remove the eslint-disable-next-line comment.**

- [ ] **Step 4: Commit**

```bash
git add src/components/classes/ClassDetailDialog.tsx
git commit -m "fix(ClassDetailDialog): replace img tag with next/image for class card image"
```

---

## Task 3: Add `vercel.json`

**Files:**
- Create: `vercel.json`

**Why:** Without `vercel.json`, heavy API routes (webhook, instructor payouts) run with Vercel's default 10s max duration — too short for DB-heavy operations. Static public assets get no explicit immutable cache headers at the CDN edge.

**Note on `maxDuration`:** Values above 10s require Vercel Pro plan. If on Hobby plan, keep all durations ≤ 10. The values below are for Pro. Comment in the file which plan is required.

- [ ] **Step 1: Create `vercel.json` at repo root**

```json
{
  "functions": {
    "src/pages/api/payments/razorpay/webhook.ts": {
      "maxDuration": 30
    },
    "src/pages/api/admin/instructor-payouts.ts": {
      "maxDuration": 30
    },
    "src/pages/api/admin/instructor-payout-adjustment.ts": {
      "maxDuration": 30
    },
    "src/pages/api/admin/dashboard/transactions.ts": {
      "maxDuration": 30
    },
    "src/pages/api/bookings.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/_next/static/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/fonts/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*\\.(?:ico|svg|png|jpg|jpeg|webp|avif|woff2?)$)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Verify `vercel.json` is valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('valid')"
```

Expected output: `valid`

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat: add vercel.json with function timeouts and static asset cache headers"
```

---

## Task 4: Convert `founder.tsx` Redirect to Static Config

**Files:**
- Modify: `next.config.mjs`
- Delete: `src/pages/founder.tsx`

**Why:** `founder.tsx` exports `getServerSideProps` that does nothing except return `{ redirect: { destination: "/story", permanent: true } }`. This spins up an SSR Lambda call on every hit just to redirect. `next.config.mjs` `redirects()` handles this at the CDN/routing layer with zero compute.

- [ ] **Step 1: Verify `founder.tsx` does only a redirect**

Read `src/pages/founder.tsx`. Confirm the only export besides `default` is:
```ts
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/story", permanent: true },
});
```
And the default export renders `null`. If there's any other logic, stop and don't delete the file.

- [ ] **Step 2: Add the redirect to `next.config.mjs`**

Find the `async headers()` function in `next.config.mjs`. Add a `redirects()` function alongside it (before or after `headers`):

```js
async redirects() {
  return [
    {
      source: "/founder",
      destination: "/story",
      permanent: true,
    },
  ];
},
```

The full `nextConfig` object should now have both `headers` and `redirects` as async functions.

- [ ] **Step 3: Delete `src/pages/founder.tsx`**

```bash
rm src/pages/founder.tsx
```

- [ ] **Step 4: Verify no other files import from `founder.tsx`**

```bash
rg "founder" src/ -g "*.tsx" -g "*.ts" -l
```

Expected: no results (or only navigation/link files that reference `/founder` as a URL string — those are fine, the redirect will handle them).

- [ ] **Step 5: Run build to confirm no broken imports**

```bash
npm run build
```

Expected: build completes without errors about missing `founder` module.

- [ ] **Step 6: Commit**

```bash
git add next.config.mjs
git rm src/pages/founder.tsx
git commit -m "refactor: move /founder→/story permanent redirect to next.config.mjs, delete SSR page"
```

---

## Execution Order

All 4 tasks are independent (zero file overlap). Run in parallel via sub-agents:

| Agent | Task | Files touched |
|---|---|---|
| Agent A | Task 1 — inlineEnv guard | `next.config.mjs`, `DEPLOY.md` |
| Agent B | Task 2 — `<img>` → `next/image` | `Hero.tsx`, `portal/book.tsx`, `admin/instructors/[id].tsx`, `ClassDetailDialog.tsx` |
| Agent C | Task 3 — `vercel.json` | `vercel.json` (new) |
| Agent D | Task 4 — founder redirect | `next.config.mjs`, `src/pages/founder.tsx` |

**Exception:** Agent A and Agent D both touch `next.config.mjs`. Run them sequentially or coordinate the merge. Recommended: Agent C and Agent B run in parallel first; then Agent A and Agent D run sequentially.

---

## Success Criteria

- [ ] `next.config.mjs`: `env: IS_AMPLIFY ? inlineEnv : {}` — no secrets in Vercel bundles
- [ ] Zero `<img` tags in `src/` (rg `"<img "` src/ returns empty)
- [ ] `vercel.json` present and valid JSON with 5 function timeout entries + 3 header rules
- [ ] `src/pages/founder.tsx` deleted; `/founder` redirect lives in `next.config.mjs`
- [ ] `npm run build` passes after all changes
