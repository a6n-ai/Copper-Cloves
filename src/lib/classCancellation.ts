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
import { CrmTriggerType } from "@/lib/crmTriggerTypes";
import { buildBookingCrmVariables, dispatchCrmEmailTriggers } from "@/lib/notifications/crmTemplatedDispatch";

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

  for (let i = 0; i < count; i++) {
    const up = await tx.userPackage.create({
      data: {
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
      },
    });
    grantedUserPackageIds.push(up.id);
  }

  return { grantedUserPackageIds };
}

/**
 * Grant refund passes for a single cancelled booking row: one to the owner if the
 * seat consumed a class, plus one per anonymous extra guest (to the owner/booker).
 * Shared by the self-serve path and the admin approval path.
 */
export async function grantRefundForBookingRow(
  tx: TxClient,
  row: {
    user_id?: string | null;
    user_package_id?: string | null;
    checked_in?: boolean | null;
    extra_guest_count?: number | null;
    is_unlimited?: boolean | null;
  },
): Promise<string[]> {
  const granted: string[] = [];
  if (ownSeatRefundEligible(row)) {
    const r = await grantCancellationPass(tx, row.user_id as string, 1);
    granted.push(...r.grantedUserPackageIds);
  }
  const anonGuests = Math.max(0, row.extra_guest_count ?? 0);
  if (anonGuests > 0 && row.user_id) {
    const r = await grantCancellationPass(tx, row.user_id, anonGuests);
    granted.push(...r.grantedUserPackageIds);
  }
  return granted;
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

  const grantedUserPackageIds = await prisma.$transaction(async (tx) => {
    const granted: string[] = [];
    const cancelledAt = new Date();

    // The booker (invited_by_user_id === null) drags their whole group along; an
    // invited row cancels only itself.
    let groupRows: Array<{
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
    }

    await tx.booking.update({
      where: { id: existing.id },
      data: { status: STATUS_CANCELLED, cancellation_date: cancelledAt },
    });

    if (groupRows.length > 0 && existing.class_schedule_id) {
      await tx.booking.updateMany({
        where: {
          invited_by_user_id: existing.user_id,
          class_schedule_id: existing.class_schedule_id,
          status: { in: [...OCCUPYING_STATUSES] },
        },
        data: { status: STATUS_CANCELLED, cancellation_date: cancelledAt },
      });
    }

    if (existing.class_schedule_id) {
      await reconcileScheduleSeats(existing.class_schedule_id, tx);
    }

    // Refund the booker's own row.
    granted.push(
      ...(await grantRefundForBookingRow(tx, {
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

  // Best-effort cancellation email (outside the tx so a CRM failure can't roll back).
  await buildBookingCrmVariables(existing.id)
    .then((variables) =>
      dispatchCrmEmailTriggers({
        triggerType: CrmTriggerType.ClassBookingCancelled,
        userId: existing.user_id,
        variables,
      }),
    )
    .catch(() => {});

  // Reconcile-on-cancel: surface any online payment on the now-cancelled booking as a
  // refund/void candidate for admin review (mirrors the self-serve path in api/bookings.ts).
  const { flagPaidCancelledOrphans } = await import("@/lib/razorpayPersistence");
  await flagPaidCancelledOrphans({ bookingId: existing.id }).catch(() => {});

  return { bookingId, cancelled: true, refund: { grantedUserPackageIds } };
}

