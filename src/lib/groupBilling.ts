import prisma from "@/lib/prisma";
import {
  BOOKING_CHECKOUT_TAX_RATE,
  type FinanceSnapshotV1,
} from "@/lib/financeBookingCheckout";

/**
 * Group-booking per-member billing resolver (spec Part B).
 *
 * Resolves which seats in a group booking are PAYABLE (booker pays money) vs
 * UNLIMITED-FREE (covered by the seat-holder's own active unlimited pass).
 *
 * Rules:
 * - An added member with an active UNLIMITED pass => seat is FREE (excluded from
 *   the booker's bill); their pass is NOT deducted.
 * - Finite-pass or no-pass added members => payable; their pass is NOT deducted.
 * - Non-account guests => always payable.
 * - Booker's own seat => payable unless the booker holds an active unlimited pass
 *   (then free). Booker's own finite-pass deduction is handled by existing
 *   booking code — this helper resolves PRICING seats only, not deductions.
 *
 * Accepts an optional prisma/tx client so it works inside transactions.
 */

// Matches the TxClient pattern used in razorpayServerCheckout.ts / classCancellation.ts.
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type PrismaLike = typeof prisma | TxClient;

export interface PerMemberSeat {
  profileId: string;
  unlimitedFree: boolean;
}

export interface PayableSeatsResult {
  /** Seats the booker actually pays for (booker + payable added members + guests). */
  payableSeats: number;
  /** Profile ids of added members whose seat is free via an active unlimited pass. */
  unlimitedFreeMemberIds: string[];
  /** Per-added-member resolution (booker not included here). */
  perMember: PerMemberSeat[];
  /** Whether the booker's own seat is free (booker holds an active unlimited pass). */
  bookerUnlimitedFree: boolean;
}

/**
 * Returns the set of profile ids (out of `profileIds`) that currently hold at
 * least one active, non-expired, non-paused unlimited pass.
 */
async function findUnlimitedHolders(
  db: PrismaLike,
  profileIds: string[],
  now: Date
): Promise<Set<string>> {
  const ids = Array.from(new Set(profileIds.filter(Boolean)));
  if (ids.length === 0) return new Set();

  const rows = await db.userPackage.findMany({
    where: {
      user_id: { in: ids },
      is_active: true,
      is_paused: false,
      expiration_date: { gt: now },
      package_type: { is_unlimited: true },
    },
    select: { user_id: true },
  });

  return new Set(rows.map((r) => r.user_id));
}

export async function resolvePayableSeats(
  bookerId: string,
  addedMemberIds: string[],
  guestCount: number,
  db: PrismaLike = prisma,
  now: Date = new Date()
): Promise<PayableSeatsResult> {
  const addedIds = Array.from(new Set((addedMemberIds ?? []).filter(Boolean)));
  const guests = Math.max(0, Math.floor(guestCount ?? 0));

  const unlimitedHolders = await findUnlimitedHolders(
    db,
    [bookerId, ...addedIds],
    now
  );

  const perMember: PerMemberSeat[] = addedIds.map((profileId) => ({
    profileId,
    unlimitedFree: unlimitedHolders.has(profileId),
  }));

  const unlimitedFreeMemberIds = perMember
    .filter((m) => m.unlimitedFree)
    .map((m) => m.profileId);

  const bookerUnlimitedFree = unlimitedHolders.has(bookerId);

  const payableAddedMembers = perMember.filter((m) => !m.unlimitedFree).length;
  const payableSeats =
    (bookerUnlimitedFree ? 0 : 1) + payableAddedMembers + guests;

  return {
    payableSeats,
    unlimitedFreeMemberIds,
    perMember,
    bookerUnlimitedFree,
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Group-billing PRICE side (spec Part B): produce a finance snapshot with the
 * seats of unlimited-pass added members excluded from the bill.
 *
 * The client builds `classFeeInr` as `dayPassEquivalentCount × perSeatPrice`
 * (every added member is charged regardless of their own pass). This reduces the
 * class fee by one per-seat price for each added member who actually holds an
 * active unlimited pass — keeping the gateway amount and the stored snapshot the
 * single, server-authoritative source (clients can't be trusted to know who is
 * unlimited). The booker's own unlimited exclusion is already handled client-side
 * (the booker's seat never enters `classFeeInr`), so `unlimitedFreeCount` here is
 * the count of unlimited *added members* only, never the booker.
 *
 * Returns a new snapshot with `classFeeInr`, `dayPassEquivalentCount`, `taxInr`
 * and `totalInr` recomputed; food/coupon fields are untouched. Totals stay
 * internally consistent with `snapshotTotalsConsistent`.
 */
export function excludeUnlimitedSeatsFromSnapshot(
  snap: FinanceSnapshotV1,
  unlimitedFreeCount: number,
): FinanceSnapshotV1 {
  const freeRequested = Math.max(0, Math.floor(unlimitedFreeCount ?? 0));
  const chargedSeats = snap.dayPassEquivalentCount;
  if (freeRequested <= 0 || chargedSeats <= 0 || snap.classFeeInr <= 0) {
    return snap;
  }

  const perSeat = snap.classFeeInr / chargedSeats;
  const freeSeats = Math.min(freeRequested, chargedSeats);
  const newClassFee = Math.max(0, round2(snap.classFeeInr - perSeat * freeSeats));

  // Recompute downstream totals exactly as snapshotTotalsConsistent expects.
  const foodNet = snap.foodFeeInr - snap.foodDiscountInr;
  const sub = newClassFee + Math.max(0, foodNet);
  const totalInr = round2(Math.max(0, sub - snap.couponDiscountInr));
  const taxInr = round2(
    (totalInr * BOOKING_CHECKOUT_TAX_RATE) / (1 + BOOKING_CHECKOUT_TAX_RATE),
  );

  return {
    ...snap,
    classFeeInr: newClassFee,
    dayPassEquivalentCount: Math.max(0, chargedSeats - freeSeats),
    taxInr,
    totalInr,
  };
}

// ---------------------------------------------------------------------------
// Self-check (no test framework): `tsx src/lib/groupBilling.ts`.
// Uses a stubbed prisma-like client so it runs without a DB connection.
// ---------------------------------------------------------------------------
async function selfCheck() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`SELF-CHECK FAILED: ${msg}`);
  };

  const stub = (unlimitedIds: string[]): PrismaLike =>
    ({
      userPackage: {
        findMany: async ({ where }: { where: { user_id: { in: string[] } } }) =>
          where.user_id.in
            .filter((id) => unlimitedIds.includes(id))
            .map((id) => ({ user_id: id })),
      },
    } as unknown as PrismaLike);

  // Case 1: finite booker, two finite added members, one guest => all payable.
  const r1 = await resolvePayableSeats("booker", ["m1", "m2"], 1, stub([]));
  assert(r1.payableSeats === 4, "case1 payableSeats should be 4");
  assert(r1.unlimitedFreeMemberIds.length === 0, "case1 no free members");
  assert(!r1.bookerUnlimitedFree, "case1 booker not free");

  // Case 2: unlimited added member => free, excluded from bill, no deduction.
  const r2 = await resolvePayableSeats("booker", ["m1", "m2"], 0, stub(["m1"]));
  assert(r2.payableSeats === 2, "case2 payableSeats should be 2 (booker + m2)");
  assert(
    r2.unlimitedFreeMemberIds.length === 1 && r2.unlimitedFreeMemberIds[0] === "m1",
    "case2 m1 is unlimited-free"
  );

  // Case 3: unlimited booker => own seat free.
  const r3 = await resolvePayableSeats("booker", ["m1"], 2, stub(["booker"]));
  assert(r3.bookerUnlimitedFree, "case3 booker free");
  assert(r3.payableSeats === 3, "case3 payableSeats should be 3 (m1 + 2 guests)");

  // Case 4: solo unlimited booker, no group => 0 payable.
  const r4 = await resolvePayableSeats("booker", [], 0, stub(["booker"]));
  assert(r4.payableSeats === 0, "case4 payableSeats should be 0");

  // Case 5: dedupe + guard against bad inputs.
  const r5 = await resolvePayableSeats("booker", ["m1", "m1", ""], -3, stub([]));
  assert(r5.perMember.length === 1, "case5 dedupes added members");
  assert(r5.payableSeats === 2, "case5 payableSeats should be 2 (booker + m1)");

  // Case 6: snapshot exclusion — 3 charged seats @945, one unlimited added member.
  const snap: FinanceSnapshotV1 = {
    version: 1,
    classFeeInr: 2835, // 3 × 945
    foodFeeInr: 0,
    foodDiscountInr: 0,
    couponDiscountInr: 0,
    taxInr: round2((2835 * BOOKING_CHECKOUT_TAX_RATE) / (1 + BOOKING_CHECKOUT_TAX_RATE)),
    totalInr: 2835,
    dayPassEquivalentCount: 3,
    noActivePackageCheckout: true,
    paymentMethod: "online",
  };
  const adj = excludeUnlimitedSeatsFromSnapshot(snap, 1);
  assert(adj.classFeeInr === 1890, "case6 classFee drops one seat (1890)");
  assert(adj.totalInr === 1890, "case6 total drops to 1890");
  assert(adj.dayPassEquivalentCount === 2, "case6 dayPass count drops to 2");
  // Case 7: zero unlimited members => snapshot unchanged.
  assert(excludeUnlimitedSeatsFromSnapshot(snap, 0) === snap, "case7 no-op returns same");

  console.log("groupBilling self-check passed");
}

if (require.main === module) {
  selfCheck().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
