/**
 * Verify group-booking lifecycle consistency for a member (READ-ONLY).
 *
 * Use it while testing in the app: have the member book a class with added
 * members, then run this after each step (book → pay → cancel / let-expire) to
 * confirm the group stays consistent.
 *
 *   npx tsx scripts/verify-group-booking.ts <booker-email> [class-name-filter]
 *
 * Checks, per booking the member made:
 *   - the booker row's status + payment
 *   - every guest row they brought (invited_by_user_id = booker, same schedule)
 *   - that guest statuses MIRROR the booker (the lifecycle binding)
 *   - that the schedule's seat counters match the live occupying rows
 *
 * Writes nothing. Safe to run against production.
 */
import prisma from "@/lib/prisma";
import { OCCUPYING_STATUSES } from "@/lib/bookingStatus";

const TZ = "Asia/Kolkata";
const fmt = (d?: Date | null) =>
  d ? d.toLocaleString("en-IN", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }) : "-";

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  const classFilter = (process.argv[3] || "").trim().toLowerCase();
  if (!email) {
    console.error("Usage: npx tsx scripts/verify-group-booking.ts <booker-email> [class-name-filter]");
    process.exit(1);
  }

  const booker = await prisma.profile.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, full_name: true, email: true },
  });
  if (!booker) {
    console.error(`No profile found for ${email}`);
    process.exit(1);
  }
  console.log(`BOOKER: ${booker.full_name ?? "?"} <${booker.email}> (${booker.id})\n`);

  // The member's own (parent) bookings — not rows where they were invited.
  const bookerRows = await prisma.booking.findMany({
    where: { user_id: booker.id, invited_by_user_id: null },
    orderBy: { created_at: "desc" },
    take: 15,
    select: {
      id: true,
      status: true,
      class_name: true,
      class_schedule_id: true,
      extra_guest_count: true,
      created_at: true,
      class_schedule: {
        select: {
          start_time: true,
          status: true,
          capacity: true,
          current_bookings: true,
          available_spots: true,
          class_model: { select: { name: true, max_capacity: true } },
        },
      },
      payments: { select: { method: true, amount_paise: true } },
    },
  });

  let problems = 0;

  for (const b of bookerRows) {
    const name = b.class_name || b.class_schedule?.class_model?.name || "Class";
    if (classFilter && !name.toLowerCase().includes(classFilter)) continue;

    const pay =
      b.payments.length > 0
        ? b.payments.map((p) => `${p.method} ₹${(p.amount_paise / 100).toFixed(0)}`).join(", ")
        : "none";
    console.log(`━━ ${name} @ ${fmt(b.class_schedule?.start_time)}`);
    console.log(`   booker booking ${b.id}  status=${b.status}  payment=${pay}  extra_guest_count=${b.extra_guest_count}`);

    // Group rows: everyone this member brought to this schedule.
    const guests = b.class_schedule_id
      ? await prisma.booking.findMany({
          where: { invited_by_user_id: booker.id, class_schedule_id: b.class_schedule_id },
          select: {
            id: true,
            status: true,
            checked_in: true,
            user_package_id: true,
            profile: { select: { full_name: true, email: true } },
            payments: { select: { id: true } },
          },
        })
      : [];

    if (guests.length === 0) {
      console.log("   group: (none)");
    } else {
      console.log(`   group: ${guests.length} guest(s)`);
      for (const g of guests) {
        const tiedPayment = g.payments.length === 0 && g.user_package_id === null;
        console.log(
          `     - ${g.profile?.full_name ?? g.profile?.email ?? "?"}  status=${g.status}` +
            `  checkedIn=${g.checked_in}  ownPayment=${g.payments.length > 0 || g.user_package_id != null ? "YES(!)" : "no"}`,
        );
        if (!tiedPayment) {
          problems++;
          console.log(`       ✗ guest has its own payment/package — should be tied to booker`);
        }
      }
      // Lifecycle binding: guest statuses should mirror the booker.
      const mismatched = guests.filter((g) => g.status !== b.status);
      if (mismatched.length > 0) {
        problems++;
        console.log(`   ✗ STATUS MISMATCH: booker=${b.status} but ${mismatched.length} guest(s) differ`);
      } else {
        console.log(`   ✓ group status mirrors booker (${b.status})`);
      }
    }

    // Seat-counter consistency vs live occupying rows.
    if (b.class_schedule_id && b.class_schedule) {
      const cap = b.class_schedule.capacity ?? b.class_schedule.class_model?.max_capacity ?? 0;
      const rows = await prisma.booking.findMany({
        where: { class_schedule_id: b.class_schedule_id, status: { in: [...OCCUPYING_STATUSES] } },
        select: { extra_guest_count: true },
      });
      const actual = rows.reduce((s, r) => s + 1 + Math.max(0, r.extra_guest_count ?? 0), 0);
      const stored = b.class_schedule.current_bookings;
      const ok = stored === actual;
      if (!ok) problems++;
      console.log(
        `   seats: capacity=${cap}  current_bookings=${stored}  available_spots=${b.class_schedule.available_spots}` +
          `  | actualOccupying=${actual}  ${ok ? "✓" : "✗ DRIFT"}`,
      );
    }
    console.log("");
  }

  console.log(problems === 0 ? "RESULT: ✓ all consistent" : `RESULT: ✗ ${problems} problem(s) found`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
