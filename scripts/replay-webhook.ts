/**
 * Replay one or more stored Razorpay webhook events through the same reconcile path the
 * live route uses — WITHOUT calling Razorpay. Reads raw_body from `razorpay_webhook_logs`.
 *
 * Usage:
 *   tsx scripts/replay-webhook.ts --event <evt_id>
 *   tsx scripts/replay-webhook.ts --order order_XXXX
 *   tsx scripts/replay-webhook.ts --payment pay_XXXX
 *   tsx scripts/replay-webhook.ts --id <log-row-uuid>
 *   tsx scripts/replay-webhook.ts --failed         # re-run every status=failed row
 *   tsx scripts/replay-webhook.ts --list [N]       # show recent log rows, no replay
 */
import prisma from "@/lib/prisma";
import { reconcileRazorpayPaymentFromWebhook } from "@/lib/razorpayPersistence";

type Args = { flag: string; value: string | null };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const flag = argv[0] ?? "--list";
  const value = argv[1] ?? null;
  return { flag, value };
}

async function rowsFor({ flag, value }: Args) {
  switch (flag) {
    case "--event":
      return prisma.razorpayWebhookLog.findMany({ where: { event_id: value ?? "" } });
    case "--order":
      return prisma.razorpayWebhookLog.findMany({ where: { razorpay_order_id: value ?? "" }, orderBy: { created_at: "asc" } });
    case "--payment":
      return prisma.razorpayWebhookLog.findMany({ where: { razorpay_payment_id: value ?? "" }, orderBy: { created_at: "asc" } });
    case "--id":
      return prisma.razorpayWebhookLog.findMany({ where: { id: value ?? "" } });
    case "--failed":
      return prisma.razorpayWebhookLog.findMany({ where: { status: "failed" }, orderBy: { created_at: "asc" } });
    default:
      return [];
  }
}

async function main() {
  const args = parseArgs();

  if (args.flag === "--list") {
    const take = args.value ? Number(args.value) : 25;
    const rows = await prisma.razorpayWebhookLog.findMany({
      orderBy: { created_at: "desc" },
      take: Number.isFinite(take) ? take : 25,
      select: {
        id: true, event_id: true, event: true, status: true, signature_valid: true,
        razorpay_order_id: true, razorpay_payment_id: true, error: true, created_at: true,
      },
    });
    for (const r of rows) {
      console.log(
        `${r.created_at.toISOString()}  ${r.status.padEnd(9)} sig=${r.signature_valid}  ${r.event ?? "—"}  order=${r.razorpay_order_id ?? "—"} pay=${r.razorpay_payment_id ?? "—"} evt=${r.event_id ?? "—"} err=${r.error ?? "—"}`,
      );
    }
    console.log(`\n${rows.length} rows.`);
    return;
  }

  const rows = await rowsFor(args);
  if (rows.length === 0) {
    console.log("No matching webhook log rows.");
    return;
  }

  console.log(`Replaying ${rows.length} event(s) (no Razorpay call)…\n`);
  for (const row of rows) {
    if (!row.signature_valid) {
      console.log(`SKIP ${row.id} (${row.event ?? "—"}) — signature was invalid, not trusted for replay.`);
      continue;
    }
    let body: { event?: string; payload?: unknown };
    try {
      body = JSON.parse(row.raw_body);
    } catch {
      console.log(`SKIP ${row.id} — raw_body not parseable.`);
      continue;
    }
    try {
      await reconcileRazorpayPaymentFromWebhook(body);
      await prisma.razorpayWebhookLog.update({
        where: { id: row.id },
        data: { status: "processed", processed_at: new Date(), error: null },
      });
      console.log(`OK   ${row.id} (${body.event ?? "—"}) order=${row.razorpay_order_id ?? "—"}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.razorpayWebhookLog
        .update({ where: { id: row.id }, data: { status: "failed", error: msg, processed_at: new Date() } })
        .catch(() => {});
      console.log(`FAIL ${row.id} (${body.event ?? "—"}) — ${msg}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
