/**
 * Dedupe duplicate ClassSchedule rows.
 *
 * Two rows are duplicates if they share (start_time, class_id, instructor_id).
 * For each group we keep the row with the most bookings (or earliest id on tie),
 * reassign any bookings on the other rows to the kept one, then delete the rest.
 *
 * Run:
 *   npx tsx scripts/dedupe-class-schedules.ts          # dry-run (default)
 *   npx tsx scripts/dedupe-class-schedules.ts --apply  # actually delete
 */
import prisma from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

type Row = {
  id: string;
  start_time: Date;
  class_id: string | null;
  instructor_id: string | null;
  _count: { bookings: number };
};

function keyOf(r: Row) {
  return `${r.start_time.toISOString()}|${r.class_id ?? ""}|${r.instructor_id ?? ""}`;
}

async function main() {
  console.log(APPLY ? "🔧 APPLY mode" : "🔎 DRY-RUN mode (use --apply to delete)");
  const rows = await prisma.classSchedule.findMany({
    select: {
      id: true,
      start_time: true,
      class_id: true,
      instructor_id: true,
      _count: { select: { bookings: true } },
    },
    orderBy: [{ start_time: "asc" }, { id: "asc" }],
  });

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = keyOf(r as Row);
    const g = groups.get(k) ?? [];
    g.push(r as Row);
    groups.set(k, g);
  }

  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  console.log(`Found ${dupGroups.length} duplicate groups (${rows.length} total rows).`);

  if (dupGroups.length === 0) {
    console.log("✅ Nothing to do.");
    return;
  }

  let toDelete = 0;
  let bookingsMoved = 0;

  for (const g of dupGroups) {
    // Keep the row with the most bookings; tie-break = earliest id.
    g.sort((a, b) =>
      b._count.bookings - a._count.bookings || a.id.localeCompare(b.id),
    );
    const keeper = g[0];
    const losers = g.slice(1);
    const slot = keeper.start_time.toISOString();
    console.log(
      `• ${slot}  class=${keeper.class_id}  instructor=${keeper.instructor_id ?? "—"}  keep=${keeper.id} (bookings=${keeper._count.bookings})  drop=${losers.length}`,
    );

    if (APPLY) {
      for (const loser of losers) {
        if (loser._count.bookings > 0) {
          const moved = await prisma.booking.updateMany({
            where: { class_schedule_id: loser.id },
            data: { class_schedule_id: keeper.id },
          });
          bookingsMoved += moved.count;
        }
        await prisma.classSchedule.delete({ where: { id: loser.id } });
        toDelete++;
      }
    } else {
      toDelete += losers.length;
      bookingsMoved += losers.reduce((s, l) => s + l._count.bookings, 0);
    }
  }

  console.log(
    APPLY
      ? `✅ Deleted ${toDelete} duplicate rows. Reassigned ${bookingsMoved} bookings.`
      : `Would delete ${toDelete} rows and reassign ${bookingsMoved} bookings. Re-run with --apply.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
