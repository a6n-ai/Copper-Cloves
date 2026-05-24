import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

// One-off: the dedicated sendBookingConfirmationEmail is now the single source
// of truth for the class-booking confirmation email. The CRM
// `class_booking_confirmed` email triggers were duplicate + blank (template
// placeholders didn't match the dispatcher variables), so deactivate them.
// Idempotent + read-confirm. Run against the database that serves the app.
const watchdog = setTimeout(() => { console.error("TIMEOUT 30s"); process.exit(2); }, 30_000);

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  const triggers = await prisma.crmTrigger.findMany({
    where: { trigger_type: "class_booking_confirmed" },
    include: { template: { select: { name: true } } },
  });

  console.log(`Found ${triggers.length} class_booking_confirmed trigger(s):`);
  for (const t of triggers) {
    console.log(`  - ${t.id} | active=${t.is_active} | email=${t.channel_email} | template=${t.template?.name ?? "(none)"}`);
  }

  const toDisable = triggers.filter((t) => t.is_active);
  if (toDisable.length === 0) {
    console.log("\nNothing to do — all already inactive.");
  } else {
    const res = await prisma.crmTrigger.updateMany({
      where: { id: { in: toDisable.map((t) => t.id) } },
      data: { is_active: false },
    });
    console.log(`\nDeactivated ${res.count} trigger(s).`);
  }

  await prisma.$disconnect();
  clearTimeout(watchdog);
  console.log("Done.");
}
main().catch((e) => { console.error(e); clearTimeout(watchdog); process.exit(1); });
