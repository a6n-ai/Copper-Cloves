import prisma from "@/lib/prisma";
async function main() {
  const total = await prisma.razorpayPayment.count();
  const withFailureReason = await prisma.razorpayPayment.count({ where: { NOT: { failure_reason: null } } });
  // webhook fulfill logs an activity? check activity_logs for webhook action
  const recentPays = await prisma.razorpayPayment.findMany({
    orderBy: { created_at: "desc" }, take: 12,
    select: { razorpay_payment_id: true, status: true, signature_verified: true, verified_at: true, failure_reason: true, created_at: true },
  });
  console.log("razorpayPayment total:", total);
  console.log("with failure_reason (webhook-only writes this):", withFailureReason);
  console.log("\nrecent payments:");
  for (const p of recentPays) {
    console.log(`  ${p.razorpay_payment_id} status=${p.status} sigVerified=${p.signature_verified} verifiedAt=${p.verified_at?.toISOString() ?? "—"} failReason=${p.failure_reason ?? "—"} created=${p.created_at.toISOString()}`);
  }
  // activity log evidence of webhook fulfillment
  const acts = await prisma.activityLog.count({ where: { OR: [ { action: { contains: "webhook" } } ] } }).catch(() => -1);
  console.log("\nactivity_logs mentioning 'webhook':", acts);
}
main().catch(e=>{console.error(e);process.exit(1);}).finally(async()=>{await prisma.$disconnect();process.exit(0);});
