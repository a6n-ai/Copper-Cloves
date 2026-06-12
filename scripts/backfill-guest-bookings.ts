import prisma from "../src/lib/prisma";

async function main() {
  const bookingsWithGuests = await prisma.booking.findMany({
    where: { guest_attendees: { not: null } },
    select: {
      id: true,
      user_id: true,
      class_schedule_id: true,
      class_name: true,
      class_time: true,
      guest_attendees: true,
    },
  });

  console.log(`Found ${bookingsWithGuests.length} bookings with guest_attendees`);
  let created = 0;
  let skipped = 0;

  for (const booking of bookingsWithGuests) {
    const guests = booking.guest_attendees as { name?: string; email?: string }[] | null;
    if (!Array.isArray(guests)) continue;

    for (const guest of guests) {
      const email = guest.email?.trim().toLowerCase();
      if (!email) {
        skipped++;
        continue;
      }

      const profile = await prisma.profile.findFirst({
        where: { email, role: "user" },
        select: { id: true },
      });
      if (!profile) {
        skipped++;
        continue;
      }

      // Skip if a booking already exists for this user + schedule
      if (booking.class_schedule_id) {
        const existing = await prisma.booking.findFirst({
          where: { user_id: profile.id, class_schedule_id: booking.class_schedule_id },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }
      }

      await prisma.booking.create({
        data: {
          user_id: profile.id,
          class_schedule_id: booking.class_schedule_id,
          status: "confirmed",
          class_name: booking.class_name,
          class_time: booking.class_time,
          invited_by_user_id: booking.user_id,
        },
      });
      console.log(`  Created booking for ${email} (invited by booking ${booking.id})`);
      created++;
    }
  }

  console.log(`Done. Created: ${created}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().then(() => process.exit(0)));
