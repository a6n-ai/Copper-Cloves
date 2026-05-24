# QR Check-In — Design Spec

**Date:** 2026-05-24
**Status:** Design for review
**Scope:** Per-schedule QR check-in for instructors (self check-in) and members, displayed on the admin dashboard, scanned from instructor/member apps.

## Goal

Each class schedule exposes **two QR codes** — one for the **instructor** (self check-in) and one for **members**. The admin dashboard shows a global popup starting **30 minutes before** a class; clicking it opens a dialog with both QRs. Instructors and members open their own app, tap **Scan**, point the camera at the relevant QR, and are checked in. Identity comes from the scanner's login session; the QR only encodes *which schedule + which role*.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Dynamic policy | **Single HMAC token per (schedule, kind)** valid for the window (no rotation, no one-time-use). |
| Display surface | **Admin dashboard global popup** (any admin page) → dialog with both QRs on a studio screen. |
| Scan direction | **Studio screen shows; users scan** with their logged-in app. |
| Concurrency | **One active class at a time** (single schedule in window; overlaps out of scope). |
| Member with no booking | **Walk-in allowed** — scan creates a booking (consumes a credit) then checks in. |

## Validity windows

- **Member QR:** valid from **30 min before** `start_time` → **30 min after** `start_time`. (Wider than the existing manual member window of −15/+10; the QR scan path uses the −30/+30 window. `check_in_outcome` still computed via `checkInOutcomeFromTimes`.)
- **Instructor QR:** valid from **30 min before** → until the instructor checks in (then the instructor half disappears), capped at **+30 min**.
- Token `exp` = `start_time + 30min` for both kinds; the instructor half is additionally hidden once `instructor_check_in_time` is set.

> Note: the existing dashboard/manual check-in endpoints keep their current windows; only the **QR scan path** uses −30/+30. Flagged so reviewers can decide whether to unify later.

## Architecture (recommended approach)

**Stateless HMAC tokens + admin global beacon + camera scanner.** No new DB tables.

Considered alternatives:
- *Persisted `CheckinSession` rows* (enables one-time-use + audit) — rejected: more DB, not needed for "single token for window."
- *Unsigned per-schedule URL QR* — rejected: anyone with the URL could trigger check-in.

### Token

```
payload = `${scheduleId}.${kind}.${exp}`   // kind ∈ "instructor" | "member"
sig     = base64url(HMAC_SHA256(payload, CHECKIN_QR_SECRET))
token   = base64url(`${payload}.${sig}`)
```

- `CHECKIN_QR_SECRET` — new env var (same handling as `CRON_SECRET`).
- Verify: recompute HMAC, constant-time compare, check `exp > now`.
- Token carries no identity → cannot impersonate; a leaked screenshot only lets the *holder* check **themselves** in, within the window.

### QR encodes
A deep link to the scan handler, e.g. `https://<origin>/checkin?t=<token>`, so scanning with a generic camera still routes into the app; in-app scanner reads the same `t`.

## Components

### Display (admin)
- **`CheckinBeacon`** — mounted once in admin chrome (in `DashboardShell` when `config.kind === "admin"`). Polls `GET /api/admin/active-checkin-schedule` every 60s. If a schedule is in `[-30min, +30min]`, renders a small fixed popup ("Class check-in is live — open QR"). Click → opens `CheckinQrDialog`. Dismissable; reappears next poll while active.
- **`CheckinQrDialog`** — `Dialog` split in two halves:
  - Left: **Instructor QR** + instructor name. Hidden/replaced with "✓ Checked in" once `instructor_check_in_time` set (dialog polls status every ~15s).
  - Right: **Member QR** + "valid until {start+30}". Greys out after expiry.
  - QRs rendered with `qrcode.react`.

### Scan (instructor + member)
- **`ScanCheckInModal`** — shared component. Opens camera via the scanner lib, decodes `t`, `POST /api/checkin/scan { token }`, shows success/error toast. Handles permission-denied / unsupported-camera gracefully.
- Instructor dashboard: a **Scan** button next to existing check-in UI.
- Member: a **Scan** button in dashboard Quick Book bar (and/or `/portal/bookings`).
- A thin **`/checkin?t=`** page handles the deep-link case (generic camera app): if logged in → auto-POST; else → send to `/login?redirect`.

## API

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/admin/active-checkin-schedule` | admin | Returns the single schedule currently in `[-30,+30]` (or null): `{ scheduleId, className, instructorName, startTime, endTime, instructorCheckedIn, instructorToken, memberToken }`. Tokens minted here (admin-gated) so the dialog needs no extra call. |
| `POST /api/checkin/scan` | instructor **or** user session | Body `{ token }`. Verify HMAC+exp, branch on `kind`. |

### `POST /api/checkin/scan` logic
1. Verify token → `{ scheduleId, kind, exp }`; reject if bad/expired.
2. **kind = instructor:** require instructor session; load schedule; `schedule.instructor_id === session.instructorId` else 403; enforce −30/+30; if `instructor_check_in_time` set → idempotent ok; else set it. (Reuses `/api/instructor/instructor-check-in` logic, widened window.)
3. **kind = member:** require user session; find this user's `confirmed` booking for `scheduleId`:
   - **Found:** set `checked_in`, `check_in_time`, `check_in_outcome` (reuse member check-in write).
   - **Not found (walk-in):** create a booking, consuming one credit from an active `UserPackage` (`credits_remaining >= 1` decrement, capacity/`current_bookings`/`available_spots` update, finance snapshot) — same path as `POST /api/bookings`; if no active pass with credits → **402 "No active pass — please buy a package"** (no silent unpaid booking); then check in.
4. Return `{ ok, kind, status }` for the toast.

## Libraries

| Need | Choice | Why |
|---|---|---|
| QR render | **`qrcode.react`** | Tiny, declarative React component; SVG output. |
| QR scan | **`@yudiel/react-qr-scanner`** | Maintained, React/Next-friendly camera + decode; falls back to `html5-qrcode` if issues. |

Both are client-only; dynamic-import the scanner to keep it off the server bundle.

## Constraints / caveats

- **Camera requires HTTPS** (secure context). Works in prod and on `localhost`; **not** on a plain LAN IP — real-device testing needs the deployed env or a tunnel.
- iOS Safari supports `getUserMedia`; some in-app webviews block it — show a "open in browser" hint on failure.
- Screenshot reuse is possible (single token) but session-gated → only self check-in within the window. Accepted per decision.
- No schema change. `ClassSchedule.instructor_check_in_time` and `Booking.check_in_*` already exist.

## Edge cases
- Member already checked in / instructor already checked in → idempotent success.
- Scan outside window → `TOO_EARLY` / `TOO_LATE` message.
- Member scans instructor QR (or vice-versa) → role/kind mismatch → 403.
- No active schedule → no popup; dialog refuses if opened stale.
- Walk-in at full capacity → 400 "class full".
- Camera denied/unsupported → modal explains, offers manual check-in fallback.

## Out of scope (this spec)
- Rotating / one-time tokens, multi-class concurrency, partner/admin scanning members' personal QRs.
- Unifying the manual check-in windows with the QR window.
- Offline check-in.

## Verification
- `npm run build` clean; `npm run lint` clean on new files.
- Token unit checks: valid/expired/tampered/wrong-kind.
- Manual (deployed/HTTPS): admin sees popup within 30 min of a seeded class; dialog shows both QRs; instructor scan → instructor half flips to ✓; member-with-booking scan → checked in; member-without-booking scan → walk-in booking + check-in (or 402 if no pass); expired QR rejected.

## Resolved decisions
1. Walk-in with **no active pass** → **hard block (402)** "buy a package". No unpaid bookings.
2. Instructor QR uses the **−30/+30** window (matches the popup), not the legacy −15/+5.
3. **Deep-link `/checkin?t=` page is in scope** — a generic phone camera scanning the QR routes into the app (and to `/login?redirect` if signed out), in addition to the in-app scanner.
