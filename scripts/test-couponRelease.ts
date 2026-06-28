/**
 * Assert-based unit test for releaseCouponRedemption (refund-on-cancel logic).
 * Run: tsx scripts/test-couponRelease.ts  (or npm run test:coupon)
 * No DB — uses an in-memory fake matching the DbClient shape couponHelpers expects.
 */
import { releaseCouponRedemption } from "../src/lib/couponHelpers";

type Row = { id: string; coupon_id: string; booking_id: string | null; user_package_id: string | null };

function fakeDb(redemptions: Row[], coupons: Record<string, number>) {
  const matches = (where: Record<string, unknown>, r: Row) =>
    (where.booking_id === undefined || r.booking_id === where.booking_id) &&
    (where.user_package_id === undefined || r.user_package_id === where.user_package_id);
  return {
    coupons,
    redemptions,
    coupon: {
      findUnique: async () => null,
      updateMany: async (args: { where: { id: string; redemption_count?: { gte: number } }; data: { redemption_count: { decrement: number } } }) => {
        const cur = coupons[args.where.id] ?? 0;
        const gte = args.where.redemption_count?.gte ?? 0;
        if (cur < gte) return { count: 0 };
        coupons[args.where.id] = cur - args.data.redemption_count.decrement;
        return { count: 1 };
      },
    },
    couponRedemption: {
      count: async () => 0,
      create: async () => ({}),
      findMany: async (args: { where: Record<string, unknown> }) =>
        redemptions.filter((r) => matches(args.where, r)).map((r) => ({ id: r.id, coupon_id: r.coupon_id })),
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        const before = redemptions.length;
        const kept = redemptions.filter((r) => !matches(args.where, r));
        redemptions.length = 0;
        redemptions.push(...kept);
        return { count: before - redemptions.length };
      },
    },
  };
}

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
}

async function main() {
  // 1. Two redemptions of the same coupon on one booking → coupon -2, rows gone.
  {
    const db = fakeDb(
      [
        { id: "r1", coupon_id: "c1", booking_id: "b1", user_package_id: null },
        { id: "r2", coupon_id: "c1", booking_id: "b1", user_package_id: null },
        { id: "r3", coupon_id: "c1", booking_id: "b2", user_package_id: null },
      ],
      { c1: 5 },
    );
    const n = await releaseCouponRedemption(db as never, { bookingId: "b1" });
    assert(n === 2, "releases both b1 redemptions");
    assert(db.coupons.c1 === 3, "coupon decremented by 2 (5→3)");
    assert(db.redemptions.length === 1 && db.redemptions[0].id === "r3", "unrelated b2 redemption untouched");
  }

  // 2. No target → no-op.
  {
    const db = fakeDb([{ id: "r1", coupon_id: "c1", booking_id: "b1", user_package_id: null }], { c1: 1 });
    const n = await releaseCouponRedemption(db as never, {});
    assert(n === 0, "no target releases nothing");
    assert(db.coupons.c1 === 1, "coupon untouched when no target");
  }

  // 3. Idempotent: cancel-twice finds nothing the second time, never goes negative.
  {
    const db = fakeDb([{ id: "r1", coupon_id: "c1", booking_id: "b1", user_package_id: null }], { c1: 1 });
    assert((await releaseCouponRedemption(db as never, { bookingId: "b1" })) === 1, "first release");
    assert(db.coupons.c1 === 0, "coupon floored at 0");
    assert((await releaseCouponRedemption(db as never, { bookingId: "b1" })) === 0, "second release is no-op");
    assert(db.coupons.c1 === 0, "still 0, never negative");
  }

  // 4. Release by package id.
  {
    const db = fakeDb([{ id: "r1", coupon_id: "c1", booking_id: null, user_package_id: "p1" }], { c1: 2 });
    const n = await releaseCouponRedemption(db as never, { userPackageId: "p1" });
    assert(n === 1 && db.coupons.c1 === 1, "release by userPackageId");
  }

  console.log(`✓ couponRelease: ${passed} assertions passed`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
