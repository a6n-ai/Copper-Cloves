# QR Check-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-schedule QR check-in — admin dashboard shows a popup 30 min before class opening a dialog with an instructor QR (hides after check-in) and a member QR (valid to +30 min); instructors and members scan from their own app to check in.

**Architecture:** Stateless HMAC tokens encode `(scheduleId, kind, exp)` — no new DB tables. An admin-chrome beacon polls for the active schedule and mints both tokens; a shared camera modal posts the scanned token to one role-routed check-in endpoint that reuses existing check-in writes (member walk-in creates a booking, hard-blocking when no active pass).

**Tech Stack:** Next.js 15 Pages Router, Prisma 7, `qrcode.react` (render), `@yudiel/react-qr-scanner` (camera), Node `crypto` HMAC.

> **Project notes for the executor:**
> - **No test framework** exists. "Tests" here are standalone `tsx` assertion scripts (run with `npx tsx`) plus `npm run build` / `npm run lint` / manual checks. Do not add jest/vitest.
> - **Do NOT auto-commit or push.** Commit steps are checkpoints — stage the changes and let the repo owner commit. (Owner preference.)
> - DB is hosted (RDS); `src/lib/prisma.ts` auto-loads `.env.local` and handles SSL. `tsx` scripts that import `@/lib/prisma` connect to **production** — keep them read-only unless intended.
> - Camera needs HTTPS; test scanning on the deployed env or `localhost`, not a LAN IP.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/checkinToken.ts` | Mint/verify HMAC check-in tokens (server-only). |
| `scripts/verify-checkin-token.ts` | Standalone assertion script for the token lib. |
| `src/lib/checkinWindow.ts` | Shared −30/+30 window constants + bounds helper. |
| `src/pages/api/admin/active-checkin-schedule.ts` | Admin: current in-window schedule + both tokens. |
| `src/pages/api/checkin/scan.ts` | Verify token → role-routed check-in (incl. member walk-in). |
| `src/components/checkin/CheckinQrDialog.tsx` | Two-QR dialog (instructor + member). |
| `src/components/checkin/CheckinBeacon.tsx` | Admin popup that polls + opens the dialog. |
| `src/components/checkin/ScanCheckInModal.tsx` | Shared camera scanner → POST scan. |
| `src/components/dashboard/DashboardShell.tsx` | Mount `CheckinBeacon` for admin; add Scan button slot. |
| `src/pages/checkin.tsx` | Deep-link `/checkin?t=` handler page. |
| `.env.example` | Document `CHECKIN_QR_SECRET`. |

---

## Task 1: Check-in token library

**Files:**
- Create: `src/lib/checkinToken.ts`
- Test: `scripts/verify-checkin-token.ts`

- [ ] **Step 1: Write the token library**

```ts
// src/lib/checkinToken.ts
import crypto from "node:crypto";

export type CheckinKind = "instructor" | "member";

export interface CheckinTokenPayload {
  scheduleId: string;
  kind: CheckinKind;
  exp: number; // epoch ms
}

function secret(): string {
  const s = process.env.CHECKIN_QR_SECRET?.trim();
  if (!s) throw new Error("CHECKIN_QR_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Build a signed, URL-safe token. `exp` is epoch ms. */
export function mintCheckinToken(scheduleId: string, kind: CheckinKind, exp: number): string {
  const payload = `${scheduleId}.${kind}.${exp}`;
  return Buffer.from(`${payload}.${sign(payload)}`, "utf8").toString("base64url");
}

/** Returns the payload if signature valid AND not expired, else null. */
export function verifyCheckinToken(token: string): CheckinTokenPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot < 0) return null;
    const payload = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    const expected = sign(payload);
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const [scheduleId, kind, expStr] = payload.split(".");
    if (!scheduleId || (kind !== "instructor" && kind !== "member")) return null;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return null;
    return { scheduleId, kind, exp };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Write the assertion script**

```ts
// scripts/verify-checkin-token.ts
process.env.CHECKIN_QR_SECRET = "test-secret-123";
import { mintCheckinToken, verifyCheckinToken } from "@/lib/checkinToken";

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error("FAIL:", msg); process.exit(1); }
  console.log("ok:", msg);
}

const future = Date.now() + 60_000;
const t = mintCheckinToken("sched-1", "member", future);
const v = verifyCheckinToken(t);
assert(!!v && v.scheduleId === "sched-1" && v.kind === "member", "valid token round-trips");

const expired = mintCheckinToken("sched-1", "member", Date.now() - 1000);
assert(verifyCheckinToken(expired) === null, "expired token rejected");

const tampered = t.slice(0, -2) + (t.endsWith("a") ? "bb" : "aa");
assert(verifyCheckinToken(tampered) === null, "tampered token rejected");

process.env.CHECKIN_QR_SECRET = "different-secret";
assert(verifyCheckinToken(t) === null, "wrong secret rejected");

console.log("\nALL PASS");
process.exit(0);
```

- [ ] **Step 3: Run the assertion script**

Run: `npx tsx scripts/verify-checkin-token.ts`
Expected: prints `ok:` lines then `ALL PASS`, exit 0.

- [ ] **Step 4: Commit (checkpoint — owner commits)**

```bash
git add src/lib/checkinToken.ts scripts/verify-checkin-token.ts
# owner: git commit -m "feat(checkin): HMAC check-in token lib"
```

---

## Task 2: Window helper + env var

**Files:**
- Create: `src/lib/checkinWindow.ts`
- Modify: `.env.example`

- [ ] **Step 1: Window helper**

```ts
// src/lib/checkinWindow.ts
export const CHECKIN_OPEN_BEFORE_MS = 30 * 60 * 1000;
export const CHECKIN_CLOSE_AFTER_MS = 30 * 60 * 1000;

/** True if `now` is within [start-30m, start+30m]. */
export function withinCheckinWindow(start: Date, now: Date = new Date()): boolean {
  const t = now.getTime();
  return t >= start.getTime() - CHECKIN_OPEN_BEFORE_MS && t <= start.getTime() + CHECKIN_CLOSE_AFTER_MS;
}

/** Token expiry for a schedule: start + 30m. */
export function checkinTokenExp(start: Date): number {
  return start.getTime() + CHECKIN_CLOSE_AFTER_MS;
}
```

- [ ] **Step 2: Document env var** — append under the cron section of `.env.example`:

```
# HMAC secret for QR check-in tokens (any long random string)
CHECKIN_QR_SECRET=
```

- [ ] **Step 3: Set it locally** — add a real value to `.env.local` (not committed):

```
CHECKIN_QR_SECRET=<openssl rand -base64 32>
```

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` and paste the value.

- [ ] **Step 4: Commit (checkpoint)**

```bash
git add src/lib/checkinWindow.ts .env.example
# owner commits
```

---

## Task 3: Active-schedule endpoint (admin)

**Files:**
- Create: `src/pages/api/admin/active-checkin-schedule.ts`

- [ ] **Step 1: Implement the endpoint**

```ts
// src/pages/api/admin/active-checkin-schedule.ts
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { mintCheckinToken } from "@/lib/checkinToken";
import {
  CHECKIN_OPEN_BEFORE_MS,
  CHECKIN_CLOSE_AFTER_MS,
  checkinTokenExp,
} from "@/lib/checkinWindow";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin")
    return res.status(403).json({ error: "Forbidden" });

  const now = Date.now();
  const schedule = await prisma.classSchedule.findFirst({
    where: {
      status: { not: "cancelled" },
      start_time: {
        gte: new Date(now - CHECKIN_CLOSE_AFTER_MS),
        lte: new Date(now + CHECKIN_OPEN_BEFORE_MS),
      },
    },
    orderBy: { start_time: "asc" },
    select: {
      id: true,
      start_time: true,
      end_time: true,
      instructor_check_in_time: true,
      class_model: { select: { name: true } },
      instructor: { select: { name: true } },
    },
  });

  if (!schedule) return res.json({ active: null });

  const exp = checkinTokenExp(schedule.start_time);
  return res.json({
    active: {
      scheduleId: schedule.id,
      className: schedule.class_model?.name ?? "Class",
      instructorName: schedule.instructor?.name ?? null,
      startTime: schedule.start_time.toISOString(),
      endTime: schedule.end_time.toISOString(),
      instructorCheckedIn: !!schedule.instructor_check_in_time,
      instructorToken: mintCheckinToken(schedule.id, "instructor", exp),
      memberToken: mintCheckinToken(schedule.id, "member", exp),
    },
  });
}
```

- [ ] **Step 2: Build check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | rg active-checkin-schedule || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit (checkpoint)**

```bash
git add src/pages/api/admin/active-checkin-schedule.ts
# owner commits
```

---

## Task 4: Scan endpoint (verify + role-routed check-in)

**Files:**
- Create: `src/pages/api/checkin/scan.ts`

Reuses: `getInstructorSession` (`src/lib/instructorAuth.ts`), `getStudioServerSession`, `checkInOutcomeFromTimes` (`src/lib/bookingAttendance.ts`), `withinCheckinWindow`.

- [ ] **Step 1: Implement the endpoint**

```ts
// src/pages/api/checkin/scan.ts
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { verifyCheckinToken } from "@/lib/checkinToken";
import { withinCheckinWindow } from "@/lib/checkinWindow";
import { getInstructorSession } from "@/lib/instructorAuth";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { checkInOutcomeFromTimes } from "@/lib/bookingAttendance";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: "token required" });

  const payload = verifyCheckinToken(token);
  if (!payload) return res.status(400).json({ error: "Invalid or expired QR. Ask the desk for a fresh code." });

  const schedule = await prisma.classSchedule.findUnique({
    where: { id: payload.scheduleId },
    select: {
      id: true, instructor_id: true, start_time: true, status: true,
      capacity: true, current_bookings: true, instructor_check_in_time: true,
    },
  });
  if (!schedule) return res.status(404).json({ error: "Class not found" });
  if (schedule.status === "cancelled") return res.status(400).json({ error: "Class is cancelled" });
  if (!withinCheckinWindow(schedule.start_time))
    return res.status(400).json({ error: "Check-in window is closed for this class." });

  // ── Instructor self check-in ──────────────────────────────
  if (payload.kind === "instructor") {
    const inst = await getInstructorSession(req, res);
    if (!inst) return res.status(401).json({ error: "Sign in as instructor first" });
    if (schedule.instructor_id !== inst.instructorId)
      return res.status(403).json({ error: "This is not your class" });
    if (schedule.instructor_check_in_time)
      return res.json({ ok: true, kind: "instructor", status: "already" });
    await prisma.classSchedule.update({
      where: { id: schedule.id },
      data: { instructor_check_in_time: new Date() },
    });
    return res.json({ ok: true, kind: "instructor", status: "checked_in" });
  }

  // ── Member check-in (existing booking or walk-in) ─────────
  const session = await getStudioServerSession(req, res);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "user")
    return res.status(401).json({ error: "Sign in as a member first" });

  const now = new Date();
  const existing = await prisma.booking.findFirst({
    where: { user_id: user.id, schedule_id: schedule.id, status: { not: "cancelled" } },
    select: { id: true, checked_in: true },
  });

  if (existing) {
    if (existing.checked_in) return res.json({ ok: true, kind: "member", status: "already" });
    await prisma.booking.update({
      where: { id: existing.id },
      data: { checked_in: true, check_in_time: now, check_in_outcome: checkInOutcomeFromTimes(schedule.start_time, now) },
    });
    return res.json({ ok: true, kind: "member", status: "checked_in" });
  }

  // Walk-in: need an active pass with credits. Hard block otherwise.
  const pkg = await prisma.userPackage.findFirst({
    where: { user_id: user.id, is_active: true, credits_remaining: { gte: 1 } },
    orderBy: { expiration_date: "asc" },
    select: { id: true },
  });
  if (!pkg) return res.status(402).json({ error: "No active pass with credits. Please buy a package." });

  if (schedule.capacity != null && (schedule.current_bookings ?? 0) >= schedule.capacity)
    return res.status(400).json({ error: "Class is full" });

  await prisma.$transaction(async (tx) => {
    await tx.userPackage.update({
      where: { id: pkg.id, credits_remaining: { gte: 1 } },
      data: { credits_remaining: { decrement: 1 } },
    });
    await tx.booking.create({
      data: {
        user_id: user.id!,
        schedule_id: schedule.id,
        user_package_id: pkg.id,
        status: "confirmed",
        booking_date: now,
        checked_in: true,
        check_in_time: now,
        check_in_outcome: checkInOutcomeFromTimes(schedule.start_time, now),
      },
    });
    const occupied = (schedule.current_bookings ?? 0) + 1;
    await tx.classSchedule.update({
      where: { id: schedule.id },
      data: {
        current_bookings: occupied,
        available_spots: schedule.capacity != null ? Math.max(0, schedule.capacity - occupied) : undefined,
      },
    });
  });

  return res.json({ ok: true, kind: "member", status: "walk_in_checked_in" });
}
```

> **Executor note:** Confirm `Booking` field names against `prisma/schema.prisma` (`schedule_id`, `user_package_id`, `booking_date`, `check_in_outcome`). If the booking-create flow in `src/pages/api/bookings.ts` writes a `finance_snapshot` or other required fields, mirror them here. Adjust the walk-in create to match that file's exact required columns before running.

- [ ] **Step 2: Build check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | rg 'checkin/scan' || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit (checkpoint)**

```bash
git add src/pages/api/checkin/scan.ts
# owner commits
```

---

## Task 5: Install QR libraries

- [ ] **Step 1: Install**

Run: `npm install qrcode.react @yudiel/react-qr-scanner`
Expected: both added to `package.json` dependencies.

- [ ] **Step 2: Verify build still compiles**

Run: `npm run build 2>&1 | rg -i "Compiled successfully|error" | head`
Expected: `Compiled successfully`.

- [ ] **Step 3: Commit (checkpoint)**

```bash
git add package.json package-lock.json
# owner commits
```

---

## Task 6: CheckinQrDialog component

**Files:**
- Create: `src/components/checkin/CheckinQrDialog.tsx`

Uses existing `Dialog` (`src/components/ui/dialog.tsx`) and `qrcode.react`.

- [ ] **Step 1: Implement**

```tsx
// src/components/checkin/CheckinQrDialog.tsx
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2 } from "lucide-react";

interface ActiveSchedule {
  scheduleId: string;
  className: string;
  instructorName: string | null;
  startTime: string;
  instructorCheckedIn: boolean;
  instructorToken: string;
  memberToken: string;
}

function qrUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/checkin?t=${encodeURIComponent(token)}`;
}

export function CheckinQrDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [data, setData] = useState<ActiveSchedule | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      const r = await fetch("/api/admin/active-checkin-schedule");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled) setData(d.active);
    };
    load();
    const id = setInterval(load, 15000); // refresh instructor status
    return () => { cancelled = true; clearInterval(id); };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-charcoal">
            {data ? `Check-in — ${data.className}` : "Check-in"}
          </DialogTitle>
        </DialogHeader>
        {!data ? (
          <p className="py-12 text-center text-charcoal/60">No class is currently open for check-in.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Instructor half */}
            <div className="flex flex-col items-center gap-3 rounded-xl border border-sage/15 p-6">
              <p className="font-display text-lg text-charcoal">Instructor</p>
              {data.instructorCheckedIn ? (
                <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-sage">
                  <CheckCircle2 size={48} />
                  <span className="font-body text-sm">Checked in</span>
                </div>
              ) : (
                <>
                  <QRCodeSVG value={qrUrl(data.instructorToken)} size={220} />
                  <p className="text-xs text-charcoal/50">{data.instructorName ?? "Instructor"} — scan to check in</p>
                </>
              )}
            </div>
            {/* Member half */}
            <div className="flex flex-col items-center gap-3 rounded-xl border border-sage/15 p-6">
              <p className="font-display text-lg text-charcoal">Members</p>
              <QRCodeSVG value={qrUrl(data.memberToken)} size={220} />
              <p className="text-xs text-charcoal/50">
                Valid until {new Date(new Date(data.startTime).getTime() + 30 * 60000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Build check** — `npx tsc --noEmit -p tsconfig.json 2>&1 | rg CheckinQrDialog || echo clean` → `clean`.
- [ ] **Step 3: Commit (checkpoint)** — `git add src/components/checkin/CheckinQrDialog.tsx`.

---

## Task 7: CheckinBeacon + mount in admin chrome

**Files:**
- Create: `src/components/checkin/CheckinBeacon.tsx`
- Modify: `src/components/dashboard/DashboardShell.tsx` (render beacon when `config.kind === "admin"`)

- [ ] **Step 1: Implement the beacon**

```tsx
// src/components/checkin/CheckinBeacon.tsx
import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { CheckinQrDialog } from "@/components/checkin/CheckinQrDialog";

export function CheckinBeacon() {
  const [active, setActive] = useState<{ className: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch("/api/admin/active-checkin-schedule");
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (!cancelled) setActive(d.active ? { className: d.active.className } : null);
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!active) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-sage px-4 py-3 text-white shadow-lg transition-transform hover:scale-105"
      >
        <QrCode size={18} />
        <span className="font-body text-sm">Check-in live · {active.className}</span>
      </button>
      <CheckinQrDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
```

- [ ] **Step 2: Mount in `DashboardShell`** — import and render inside the `SidebarInset`, only for admin. Add import near the other dashboard imports:

```tsx
import { CheckinBeacon } from "@/components/checkin/CheckinBeacon";
```

Then immediately after the opening `<SidebarInset>` tag, add:

```tsx
        {config.kind === "admin" ? <CheckinBeacon /> : null}
```

- [ ] **Step 3: Build check** — `npm run build 2>&1 | rg -i "Compiled successfully|error" | head` → `Compiled successfully`.
- [ ] **Step 4: Commit (checkpoint)** — `git add src/components/checkin/CheckinBeacon.tsx src/components/dashboard/DashboardShell.tsx`.

---

## Task 8: ScanCheckInModal (shared camera scanner)

**Files:**
- Create: `src/components/checkin/ScanCheckInModal.tsx`

Uses `@yudiel/react-qr-scanner` (dynamic-imported) + existing `Dialog`. The QR encodes `/checkin?t=<token>`; extract the `t` param before posting.

- [ ] **Step 1: Implement**

```tsx
// src/components/checkin/ScanCheckInModal.tsx
import { useState } from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((m) => m.Scanner),
  { ssr: false },
);

function extractToken(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.searchParams.get("t");
  } catch {
    return raw || null; // raw token fallback
  }
}

export function ScanCheckInModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(token: string) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/checkin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setMsg({ ok: true, text: d.status === "already" ? "Already checked in ✓" : "Checked in ✓" });
      else setMsg({ ok: false, text: typeof d.error === "string" ? d.error : "Check-in failed" });
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-charcoal">Scan to check in</DialogTitle>
        </DialogHeader>
        {msg ? (
          <div className={`rounded-lg p-4 text-center font-body text-sm ${msg.ok ? "bg-sage/10 text-sage" : "bg-red-50 text-red-700"}`}>
            {msg.text}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl">
            <Scanner
              onScan={(codes) => {
                const raw = codes?.[0]?.rawValue;
                if (!raw) return;
                const token = extractToken(raw);
                if (token) void submit(token);
              }}
              onError={() => setMsg({ ok: false, text: "Camera unavailable — allow camera access or open in your browser." })}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Build check** — `npm run build 2>&1 | rg -i "Compiled successfully|error" | head` → `Compiled successfully`.
- [ ] **Step 3: Commit (checkpoint)** — `git add src/components/checkin/ScanCheckInModal.tsx`.

---

## Task 9: Instructor dashboard Scan button

**Files:**
- Modify: `src/pages/instructor/dashboard.tsx`

- [ ] **Step 1: Add state + import** — near the top of the component add:

```tsx
import { ScanCheckInModal } from "@/components/checkin/ScanCheckInModal";
import { QrCode } from "lucide-react";
```

and inside the component body:

```tsx
const [scanOpen, setScanOpen] = useState(false);
```

- [ ] **Step 2: Add the button + modal** — inside the `PageHeader` actions (or just below the header). Use the `PageHeader actions` prop:

```tsx
<PageHeader
  title={/* existing greeting title */}
  subtitle={/* existing subtitle */}
  actions={
    <Button onClick={() => setScanOpen(true)} className="bg-sage hover:bg-sage/90 text-white font-body">
      <QrCode className="mr-2 h-4 w-4" /> Scan to check in
    </Button>
  }
/>
<ScanCheckInModal open={scanOpen} onOpenChange={setScanOpen} />
```

> Executor: the instructor header currently uses `PageHeader` with `title`/`subtitle` only — add the `actions` prop as shown, keeping the existing title/subtitle expressions.

- [ ] **Step 3: Build check** — `npm run build 2>&1 | rg -i "Compiled successfully|error" | head` → `Compiled successfully`.
- [ ] **Step 4: Commit (checkpoint)** — `git add src/pages/instructor/dashboard.tsx`.

---

## Task 10: Member dashboard Scan button

**Files:**
- Modify: `src/pages/portal/dashboard.tsx` (Quick Book bar)

- [ ] **Step 1: Add import + state**

```tsx
import { ScanCheckInModal } from "@/components/checkin/ScanCheckInModal";
import { QrCode } from "lucide-react";
```

and in the component body:

```tsx
const [scanOpen, setScanOpen] = useState(false);
```

- [ ] **Step 2: Add a Scan button** to the Quick Book actions grid (alongside Book a Class / Buy Packages), and render the modal once:

```tsx
<Button
  type="button"
  variant="outline"
  onClick={() => setScanOpen(true)}
  className="border-sage/20 text-charcoal hover:bg-cream font-body justify-start"
>
  <span className="mr-2"><AnimatedIcon icon={QrCode} size={16} /></span>
  Scan check-in
</Button>
```

Place once near the page root (e.g. before the closing `</div>` of the page wrapper):

```tsx
<ScanCheckInModal open={scanOpen} onOpenChange={setScanOpen} />
```

- [ ] **Step 3: Build check** — `npm run build 2>&1 | rg -i "Compiled successfully|error" | head` → `Compiled successfully`.
- [ ] **Step 4: Commit (checkpoint)** — `git add src/pages/portal/dashboard.tsx`.

---

## Task 11: Deep-link `/checkin?t=` page

**Files:**
- Create: `src/pages/checkin.tsx`

Handles a generic phone camera that opens the QR URL: if signed in, auto-submit; else redirect to `/login?redirect=/checkin?t=...`.

- [ ] **Step 1: Implement**

```tsx
// src/pages/checkin.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";

export default function CheckinDeepLink() {
  const router = useRouter();
  const { status } = useSession();
  const [msg, setMsg] = useState("Checking you in…");

  useEffect(() => {
    if (status === "loading") return;
    const t = typeof router.query.t === "string" ? router.query.t : "";
    if (!t) { setMsg("Missing check-in code."); return; }
    if (status === "unauthenticated") {
      void router.replace(`/login?redirect=${encodeURIComponent(`/checkin?t=${t}`)}`);
      return;
    }
    (async () => {
      const r = await fetch("/api/checkin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok ? "Checked in ✓ You can close this." : (d.error ?? "Check-in failed."));
    })();
  }, [status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-6">
      <p className="font-display text-2xl text-charcoal text-center">{msg}</p>
    </div>
  );
}
```

> Executor: confirm `/login` honors a `redirect` query param; if it uses a different param name, match it.

- [ ] **Step 2: Build check** — `npm run build 2>&1 | rg -i "Compiled successfully|error|/checkin" | head` → compiles, `/checkin` route listed.
- [ ] **Step 3: Commit (checkpoint)** — `git add src/pages/checkin.tsx`.

---

## Task 12: Final verification

- [ ] **Step 1: Lint changed files**

Run: `npx eslint src/lib/checkinToken.ts src/lib/checkinWindow.ts src/pages/api/checkin/scan.ts src/pages/api/admin/active-checkin-schedule.ts src/components/checkin/*.tsx src/pages/checkin.tsx 2>&1 | rg "error" | rg -v "prefer-const" || echo "no new errors"`
Expected: `no new errors`.

- [ ] **Step 2: Full build**

Run: `npm run build 2>&1 | rg -i "Compiled successfully|error" | head`
Expected: `Compiled successfully`.

- [ ] **Step 3: Manual smoke (deployed/HTTPS or localhost)**
  - Seed/pick a class starting within 30 min. As **admin**, confirm the bottom-right "Check-in live" popup appears; click → dialog shows both QRs.
  - As the schedule's **instructor**, Scan the instructor QR → success; admin dialog flips instructor half to "✓ Checked in" within ~15s.
  - As a **member with a booking**, Scan the member QR → "Checked in ✓".
  - As a **member with no booking but an active pass**, Scan → walk-in booking created + checked in.
  - As a **member with no pass**, Scan → "No active pass" (402) message.
  - Wait past `start+30min` → Scan → "window is closed".

- [ ] **Step 4: Commit (checkpoint)** — final.

---

## Spec coverage check

- Two QR per schedule (instructor/member) → Tasks 1, 3, 6 ✓
- Dynamic = single HMAC token for window → Tasks 1, 2 ✓
- Admin global popup 30 min before, any page → Task 7 (mounted in `DashboardShell` admin chrome) ✓
- Dialog: instructor QR hides after check-in; member QR valid to +30 → Task 6 ✓
- Scan buttons (instructor + member) open camera → Tasks 8, 9, 10 ✓
- Role-routed check-in; member walk-in hard-block 402 → Task 4 ✓
- Instructor −30/+30 window → Tasks 2, 4 ✓
- Any-camera deep link → Task 11 ✓
- No schema change ✓ (reuses existing columns)
