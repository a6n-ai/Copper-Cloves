/**
 * Backfill: mirror existing razorpay_payments rows into the unified `payments` table.
 *
 * Idempotent — skips rows whose razorpay_payment_id is already mirrored (unique index).
 * Uses raw SQL because the Prisma client no longer exposes the old ownership columns
 * (user_id / booking_id / user_package_id) once the slim schema is applied.
 *
 * Run this BEFORE applying the column-drop migration to razorpay_payments.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

type Row = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  user_id: string;
  booking_id: string | null;
  user_package_id: string | null;
  amount_paise: number | null;
  currency: string | null;
  status: string;
  signature_verified: boolean;
  created_at: Date;
};

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT razorpay_payment_id, razorpay_order_id, user_id, booking_id, user_package_id,
           amount_paise, currency, status, signature_verified, created_at
    FROM razorpay_payments
    ORDER BY created_at ASC
  `);

  const existing = new Set(
    (await prisma.payment.findMany({
      where: { razorpay_payment_id: { not: null } },
      select: { razorpay_payment_id: true },
    })).map((p) => p.razorpay_payment_id!),
  );

  let created = 0, skipped = 0;
  for (const r of rows) {
    if (existing.has(r.razorpay_payment_id)) { skipped += 1; continue; }
    const method = r.signature_verified ? "razorpay_online" : "razorpay_completed";
    const status =
      r.signature_verified ? "succeeded" :
      r.status?.toLowerCase() === "failed" ? "failed" :
      "pending";

    await prisma.$executeRawUnsafe(
      `INSERT INTO payments
         (id, user_id, user_package_id, booking_id, method, status, amount_paise, currency,
          reference, razorpay_payment_id, razorpay_order_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4::"PaymentMethod", $5::"PaymentStatus", $6, $7,
               $8, $9, $10, $11, NOW())`,
      r.user_id,
      r.user_package_id,
      r.booking_id,
      method,
      status,
      r.amount_paise ?? 0,
      r.currency ?? "INR",
      r.razorpay_payment_id,
      r.razorpay_payment_id,
      r.razorpay_order_id,
      r.created_at,
    );
    created += 1;
  }

  console.log(`Backfilled: ${created} new, ${skipped} skipped, ${rows.length} total razorpay_payments.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
