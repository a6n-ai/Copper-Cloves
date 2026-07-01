/**
 * Class cancellation + refund-as-pass logic (spec §9).
 *
 * This module OWNS the cancel/refund primitives. The cancellation APIs (admin
 * approve, member late-cancel request) and the self-serve before-cutoff path in
 * `api/bookings.ts` call through here — do NOT re-derive grant/refund logic.
 *
 * Policy (spec §9):
 *  - Cancelling a class that consumed a class (non-unlimited pass) grants the
 *    member a `1 Class Pass` (origin=cancellation, expiry = now +
 *    cancelled_pass_validity_days).
 *  - Unlimited holders consumed nothing → no refund pass.
 *  - Anonymous extra guests' (extra_guest_count, no Profile) refund passes go to
 *    the booker.
 */
import prisma from "@/lib/prisma";
import { OCCUPYING_STATUSES } from "@/lib/bookingStatus";
import { reconcileScheduleSeats } from "@/lib/seatCounts";
import { getStudioSettings } from "@/lib/studioSettings";
import { sendStudioEmail } from "@/lib/notifications/email";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Canonical name of the comp/refund primitive package (see packageCatalog.ts). */
export const ONE_CLASS_PASS_NAME = "1 Class Pass";

const STATUS_CANCELLED = "cancelled" as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface GrantCancellationPassResult {
  /** ids of the UserPackage rows granted (one per refunded class) */
  grantedUserPackageIds: string[];
}

/**
 * True when a cancelled seat consumed a class credit and is owed a refund pass:
 * belongs to a Profile, was paid with a non-unlimited pass, and was not attended.
 */
export type RefundOutcome = "class_pass" | "none_unlimited" | "none_no_pass";

/**
 * What a seat would receive if cancelled now — drives the cancel-dialog preview
 * AND the actual grant, so the two can't drift. Unlimited holders consume
 * nothing; a non-unlimited seat with an attached pass (not yet attended) earns a
 * `1 Class Pass`; anything else gets nothing.
 */
export function refundOutcomeFor(row: {
  user_package_id?: string | null;
  checked_in?: boolean | null;
  is_unlimited?: boolean | null;
}): RefundOutcome {
  if (row.is_unlimited) return "none_unlimited";
  if (row.user_package_id && !row.checked_in) return "class_pass";
  return "none_no_pass";
}

export function ownSeatRefundEligible(row: {
  user_id?: string | null;
  user_package_id?: string | null;
  checked_in?: boolean | null;
  is_unlimited?: boolean | null;
}): boolean {
  return Boolean(row.user_id) && Boolean(row.user_package_id) && !row.is_unlimited && !row.checked_in;
}

/**
 * Grant N `1 Class Pass` refund passes to a profile for a cancelled class.
 * Looks up the `1 Class Pass` PackageType (by name) and reads
 * cancelled_pass_validity_days from StudioSettings.
 *
 * @throws if the `1 Class Pass` PackageType does not exist (catalog seed not run).
 */
export async function grantCancellationPass(
  tx: TxClient,
  profileId: string,
  count: number = 1,
): Promise<GrantCancellationPassResult> {
  const grantedUserPackageIds: string[] = [];
  if (!profileId || count < 1) return { grantedUserPackageIds };

  const pt = await tx.packageType.findFirst({ where: { name: ONE_CLASS_PASS_NAME } });
  if (!pt) {
    throw new Error(
      `grantCancellationPass: "${ONE_CLASS_PASS_NAME}" PackageType not found — run the package catalog seed before cancelling classes.`,
    );
  }

  const { cancelled_pass_validity_days } = await getStudioSettings();
  const expiration = new Date(Date.now() + cancelled_pass_validity_days * DAY_MS);

  // Single batched insert instead of N round-trips inside the open transaction.
  const created = await tx.userPackage.createManyAndReturn({
    data: Array.from({ length: count }, () => ({
      user_id: profileId,
      package_type_id: pt.id,
      credits_remaining: 1,
      credits_total: 1,
      expiration_date: expiration,
      is_active: true,
      pass_type: pt.type,
      is_comp: false,
      grant_note: "Class cancellation refund",
      origin: "cancellation",
    })),
    select: { id: true },
  });
  grantedUserPackageIds.push(...created.map((u) => u.id));

  return { grantedUserPackageIds };
}

/**
 * Refund the owner's cancelled class credit.
 *
 * Preferred: restore the credit to the ORIGINAL pass when it's still live (active,
 * not expired) — one pass grows back instead of the wallet fragmenting into many
 * standalone 1-Class passes. Validity is extended by the "days lost": the forward
 * window the member had reserved for that class (class start − now). Admin can
 * further adjust a pass's expiry via `PATCH /api/admin/members`.
 *
 * Fallback: if the original pass is gone/expired/unlimited-N-A, grant a fresh
 * `1 Class Pass` (origin=cancellation) — the legacy behavior.
 *
 * @returns the UserPackage id the credit landed on (original or new).
 */
export async function refundOwnerClassCredit(
  tx: TxClient,
  ownerId: string,
  originalPackageId: string | null,
  bookingId: string | null | undefined,
): Promise<string | null> {
  if (originalPackageId) {
    const pass = await tx.userPackage.findUnique({
      where: { id: originalPackageId },
      include: { package_type: { select: { is_unlimited: true } } },
    });
    const now = Date.now();
    const live =
      pass &&
      pass.user_id === ownerId &&
      pass.is_active &&
      !pass.package_type?.is_unlimited &&
      pass.expiration_date.getTime() > now;
    if (live) {
      // "Days lost" = whole days between now and the class the member gave up.
      // ponytail: reserved-forward-window rule; tune here if policy changes.
      let daysLost = 0;
      if (bookingId) {
        const bk = await tx.booking.findUnique({
          where: { id: bookingId },
          select: { class_time: true, class_schedule: { select: { start_time: true } } },
        });
        const startRaw = bk?.class_schedule?.start_time ?? bk?.class_time ?? null;
        if (startRaw) {
          daysLost = Math.max(0, Math.ceil((new Date(startRaw).getTime() - now) / DAY_MS));
        }
      }
      const newExpiry = new Date(pass.expiration_date.getTime() + daysLost * DAY_MS);
      await tx.userPackage.update({
        where: { id: pass.id },
        data: {
          credits_remaining: { increment: 1 },
          expiration_date: newExpiry,
          is_active: true,
        },
      });
      return pass.id;
    }
  }
  const r = await grantCancellationPass(tx, ownerId, 1);
  return r.grantedUserPackageIds[0] ?? null;
}

/**
 * Grant refund passes for a single cancelled booking row: one to the owner if the
 * seat consumed a class, plus one per anonymous extra guest (to the owner/booker).
 * Shared by the self-serve path and the admin approval path.
 */
export async function grantRefundForBookingRow(
  tx: TxClient,
  row: {
    id?: string | null;
    user_id?: string | null;
    user_package_id?: string | null;
    checked_in?: boolean | null;
    extra_guest_count?: number | null;
    is_unlimited?: boolean | null;
  },
): Promise<string[]> {
  const granted: string[] = [];
  if (ownSeatRefundEligible(row)) {
    const passId = await refundOwnerClassCredit(
      tx,
      row.user_id as string,
      row.user_package_id ?? null,
      row.id,
    );
    if (passId) granted.push(passId);
  }
  const anonGuests = Math.max(0, row.extra_guest_count ?? 0);
  if (anonGuests > 0 && row.user_id) {
    const r = await grantCancellationPass(tx, row.user_id, anonGuests);
    granted.push(...r.grantedUserPackageIds);
  }
  // Stamp the cancelled booking so the member portal can show "Refunded:
  // 1 Class Pass" and gate the manual refund-request button (no double refund).
  if (granted.length > 0 && row.id) {
    await tx.booking.update({
      where: { id: row.id },
      data: { refund_status: "auto_pass", refund_user_package_id: granted[0] },
    });
  }
  return granted;
}

/**
 * Distinct user_ids that should receive the cancellation/refund email for a
 * group booking, deduped:
 *  - The BOOKER (invited_by === null) cancelling drags the whole group → notify
 *    the booker AND every group member.
 *  - A GROUP MEMBER cancelling their own row → notify that member AND the booker.
 * The canceller is always included. Anonymous extra guests (no user_id) are not
 * representable here and are simply absent from `groupMemberIds`.
 */
export function cancellationRecipientIds(
  cancellerId: string,
  invitedByUserId: string | null,
  groupMemberIds: string[],
): string[] {
  const ids = new Set<string>([cancellerId]);
  if (invitedByUserId === null) {
    for (const id of groupMemberIds) if (id) ids.add(id);
  } else if (invitedByUserId) {
    ids.add(invitedByUserId);
  }
  return [...ids];
}

/** Human label for "what this seat got back" — drives the email refund roster. */
export function refundLabel(row: {
  refund_status?: string | null;
  refund_amount_paise?: number | null;
  user_package_id?: string | null;
  checked_in?: boolean | null;
  is_unlimited?: boolean | null;
}): string {
  switch (row.refund_status) {
    case "auto_pass":
    case "approved_pass":
      return "1 Class Pass";
    case "approved_amount":
      return `₹${Math.round((row.refund_amount_paise ?? 0) / 100).toLocaleString("en-IN")}`;
    case "requested":
      return "refund requested";
    case "denied":
      return "no refund";
    default: {
      const o = refundOutcomeFor({
        user_package_id: row.user_package_id,
        checked_in: row.checked_in,
        is_unlimited: row.is_unlimited,
      });
      return o === "class_pass"
        ? "1 Class Pass"
        : o === "none_unlimited"
        ? "no refund (unlimited)"
        : "no refund";
    }
  }
}

const NOTIFY_ROW_SELECT = {
  user_id: true,
  refund_status: true,
  refund_amount_paise: true,
  user_package_id: true,
  checked_in: true,
  user_package: { select: { package_type: { select: { is_unlimited: true } } } },
  profile: { select: { full_name: true, email: true } },
} as const;

function displayName(p: { full_name?: string | null; email?: string | null } | null | undefined): string {
  return p?.full_name?.trim() || p?.email?.split("@")[0] || "Member";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The `{{Refund_Roster}}` HTML card ("who got what") for the cancellation email,
 *  or "" when it's a solo (non-group) booking. */
function buildRefundRosterHtml(rows: { name: string; detail: string }[]): string {
  if (rows.length < 1) return "";
  const tr = rows
    .map((r, i) => {
      const bb = i < rows.length - 1 ? "border-bottom:1px solid #E8E4DC" : "";
      return `<tr><td style="font-family:Georgia,serif;font-size:14px;color:#2C2C2C;padding:10px 0;${bb}">${escapeHtml(r.name)}</td><td style="font-family:Georgia,serif;font-size:14px;color:#888888;padding:10px 0;text-align:right;${bb}">${escapeHtml(r.detail)}</td></tr>`;
    })
    .join("");
  return `<div style="background:#fff;border:1px solid #E8E4DC;border-radius:12px;padding:24px;margin-bottom:16px"><p style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:#7C9070;margin:0 0 20px;text-align:center">refund summary</p><table style="width:100%;border-collapse:collapse">${tr}</table></div>`;
}

/**
 * Email every distinct affected member of a (possibly group) booking that it was
 * cancelled — via the admin-editable CRM template (ClassBookingCancelled),
 * supplying the class details plus a `{{Refund_Roster}}` "who got what" card.
 * One email per person, never two. Booker-cancel notifies the whole group; an
 * invited member's cancel notifies that member + the booker. Best-effort.
 */
export async function notifyGroupCancellation(opts: {
  bookingId: string;
  cancellerId: string;
  invitedByUserId: string | null;
  groupMemberIds: string[];
}): Promise<void> {
  try {
    const cancelled = await prisma.booking.findUnique({
      where: { id: opts.bookingId },
      select: { class_schedule_id: true },
    });

    // Seats actually cancelled in this action drive the roster: booker-cancel →
    // booker + group; an invited member's cancel → just that member.
    const affectedUserIds =
      opts.invitedByUserId === null
        ? [opts.cancellerId, ...opts.groupMemberIds]
        : [opts.cancellerId];

    const rows =
      cancelled?.class_schedule_id && affectedUserIds.length
        ? await prisma.booking.findMany({
            where: {
              class_schedule_id: cancelled.class_schedule_id,
              user_id: { in: affectedUserIds },
              status: STATUS_CANCELLED,
            },
            select: NOTIFY_ROW_SELECT,
          })
        : [];

    const isGroup =
      (opts.invitedByUserId === null && opts.groupMemberIds.length > 0) ||
      opts.invitedByUserId !== null;
    const rosterHtml = isGroup
      ? buildRefundRosterHtml(
          rows.map((r) => ({
            name: displayName(r.profile),
            detail: refundLabel({
              refund_status: r.refund_status,
              refund_amount_paise: r.refund_amount_paise,
              user_package_id: r.user_package_id,
              checked_in: r.checked_in,
              is_unlimited: r.user_package?.package_type?.is_unlimited ?? false,
            }),
          })),
        )
      : "";

    const recipients = cancellationRecipientIds(
      opts.cancellerId,
      opts.invitedByUserId,
      opts.groupMemberIds,
    );
    // Per-recipient template choice: someone whose own cancelled seat earned a
    // pass gets the "credit returned" copy; everyone else (no refund, or the
    // booker observing a member's cancel — no own cancelled row) gets the
    // "no credit" copy. Recipients are already distinct.
    const rowByUser = new Map(rows.map((r) => [r.user_id, r]));
    for (const userId of recipients) {
      const row = rowByUser.get(userId);
      const gotPass =
        !!row &&
        refundLabel({
          refund_status: row.refund_status,
          refund_amount_paise: row.refund_amount_paise,
          user_package_id: row.user_package_id,
          checked_in: row.checked_in,
          is_unlimited: row.user_package?.package_type?.is_unlimited ?? false,
        }) === "1 Class Pass";
      const kind = gotPass ? "booking_cancelled" : "booking_cancelled_no_credit";
      await sendStudioEmail(kind, {
        userId,
        data: { bookingId: opts.bookingId, refundRosterHtml: rosterHtml, creditsCount: "1" },
      }).catch(() => {});
    }
  } catch {
    // swallow — a notification failure must never affect the cancel result
  }
}

export interface CancelBookingWithRefundOptions {
  /** who triggered the cancel; for admin approvals this is the admin id */
  cancelledBy?: string;
  /** convenience flag — admin-initiated (after-cutoff) cancellation */
  byAdmin?: boolean;
  /** free-text reason (carried from the cancellation request) */
  reason?: string;
}

export interface CancelBookingWithRefundResult {
  bookingId: string;
  cancelled: boolean;
  refund: GrantCancellationPassResult;
}

const REFUND_ROW_SELECT = {
  id: true,
  user_id: true,
  user_package_id: true,
  checked_in: true,
  extra_guest_count: true,
  user_package: { select: { package_type: { select: { is_unlimited: true } } } },
} as const;

/**
 * Cancel a booking (with group cascade + seat reconcile) and grant refund passes
 * to each affected member, mirroring the self-serve before-cutoff path in
 * `api/bookings.ts`. Used for admin approvals of late-cancel requests.
 */
export async function cancelBookingWithRefund(
  bookingId: string,
  _options: CancelBookingWithRefundOptions = {},
): Promise<CancelBookingWithRefundResult> {
  const existing = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { user_package: { select: { package_type: { select: { is_unlimited: true } } } } },
  });

  if (!existing) {
    return { bookingId, cancelled: false, refund: { grantedUserPackageIds: [] } };
  }
  if (existing.status === STATUS_CANCELLED) {
    return { bookingId, cancelled: false, refund: { grantedUserPackageIds: [] } };
  }

  // Lifted out of the tx so the post-commit email fan-out can address each
  // cascaded group member (the booker drags their whole group along).
  let groupMemberUserIds: string[] = [];

  const grantedUserPackageIds = await prisma.$transaction(async (tx) => {
    const granted: string[] = [];
    const cancelledAt = new Date();

    // The booker (invited_by_user_id === null) drags their whole group along; an
    // invited row cancels only itself.
    let groupRows: Array<{
      id: string;
      user_id: string;
      user_package_id: string | null;
      checked_in: boolean;
      extra_guest_count: number | null;
      user_package: { package_type: { is_unlimited: boolean } | null } | null;
    }> = [];

    if (existing.invited_by_user_id === null && existing.class_schedule_id) {
      groupRows = await tx.booking.findMany({
        where: {
          invited_by_user_id: existing.user_id,
          class_schedule_id: existing.class_schedule_id,
          status: { in: [...OCCUPYING_STATUSES] },
        },
        select: REFUND_ROW_SELECT,
      });
      groupMemberUserIds = groupRows.map((r) => r.user_id);
    }

    await tx.booking.update({
      where: { id: existing.id },
      data: {
        status: STATUS_CANCELLED,
        cancellation_date: cancelledAt,
        cancelled_by: _options.byAdmin ? "admin" : "member",
        cancellation_reason: _options.reason ?? null,
      },
    });

    if (groupRows.length > 0 && existing.class_schedule_id) {
      await tx.booking.updateMany({
        where: {
          invited_by_user_id: existing.user_id,
          class_schedule_id: existing.class_schedule_id,
          status: { in: [...OCCUPYING_STATUSES] },
        },
        data: {
          status: STATUS_CANCELLED,
          cancellation_date: cancelledAt,
          cancelled_by: _options.byAdmin ? "admin" : "member",
          cancellation_reason: _options.reason ?? null,
        },
      });
    }

    if (existing.class_schedule_id) {
      await reconcileScheduleSeats(existing.class_schedule_id, tx);
    }

    // Refund the booker's own row.
    granted.push(
      ...(await grantRefundForBookingRow(tx, {
        id: existing.id,
        user_id: existing.user_id,
        user_package_id: existing.user_package_id,
        checked_in: existing.checked_in,
        extra_guest_count: existing.extra_guest_count,
        is_unlimited: existing.user_package?.package_type?.is_unlimited ?? false,
      })),
    );

    // Refund each cascaded group member.
    for (const row of groupRows) {
      granted.push(
        ...(await grantRefundForBookingRow(tx, {
          id: row.id,
          user_id: row.user_id,
          user_package_id: row.user_package_id,
          checked_in: row.checked_in,
          extra_guest_count: row.extra_guest_count,
          is_unlimited: row.user_package?.package_type?.is_unlimited ?? false,
        })),
      );
    }

    return granted;
  });

  // Best-effort cancellation email (outside the tx so a CRM failure can't roll
  // back). Group-aware: booker cancel notifies the whole group; an invited
  // member's cancel notifies that member + the booker. One email per person.
  await notifyGroupCancellation({
    bookingId: existing.id,
    cancellerId: existing.user_id,
    invitedByUserId: existing.invited_by_user_id,
    groupMemberIds: groupMemberUserIds,
  });

  // Reconcile-on-cancel: surface any online payment on the now-cancelled booking as a
  // refund/void candidate for admin review (mirrors the self-serve path in api/bookings.ts).
  const { flagPaidCancelledOrphans } = await import("@/lib/razorpayPersistence");
  await flagPaidCancelledOrphans({ bookingId: existing.id }).catch(() => {});

  return { bookingId, cancelled: true, refund: { grantedUserPackageIds } };
}

