import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

// READ-ONLY: investigate a member's bookings + their guest attendees, and check
// whether each guest exists as a profile.
async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  const bookerEmail = "smenon16@gmail.com";
  const booker = await prisma.profile.findFirst({ where: { email: bookerEmail, role: "user" } });
  console.log("=== Booker ===");
  console.log(booker ? `${booker.full_name ?? "(no name)"} | ${booker.email} | id=${booker.id}` : "NOT FOUND");

  if (booker) {
    const bookings = await prisma.booking.findMany({
      where: { user_id: booker.id },
      orderBy: { booking_date: "desc" },
      select: {
        id: true,
        class_name: true,
        class_time: true,
        booking_date: true,
        extra_guest_count: true,
        guest_attendees: true,
        email: true,
        class_schedule: { select: { start_time: true, class_model: { select: { name: true } } } },
      },
    });
    console.log(`\n=== Booker's bookings (${bookings.length}) ===`);
    for (const b of bookings) {
      const cls = b.class_schedule?.class_model?.name ?? b.class_name ?? "Class";
      const when = b.class_schedule?.start_time ?? b.class_time ?? b.booking_date;
      console.log(`- ${cls} @ ${when ? new Date(when).toISOString() : "?"} | extra_guests=${b.extra_guest_count} | guest_attendees=${JSON.stringify(b.guest_attendees)}`);
    }
  }

  console.log("\n=== Search profiles matching 'rhea' (name or email) ===");
  const rhea = await prisma.profile.findMany({
    where: {
      OR: [
        { full_name: { contains: "rhea", mode: "insensitive" } },
        { email: { contains: "rhea", mode: "insensitive" } },
      ],
    },
    select: { id: true, full_name: true, email: true, role: true, created_at: true },
  });
  if (rhea.length === 0) console.log("NO profile found matching 'rhea'");
  for (const r of rhea) console.log(`- ${r.full_name ?? "(no name)"} | ${r.email} | role=${r.role} | created=${r.created_at.toISOString()}`);

  console.log("\n=== Search profiles matching 'menon' ===");
  const menon = await prisma.profile.findMany({
    where: {
      OR: [
        { full_name: { contains: "menon", mode: "insensitive" } },
        { email: { contains: "menon", mode: "insensitive" } },
      ],
    },
    select: { full_name: true, email: true, role: true },
  });
  for (const m of menon) console.log(`- ${m.full_name ?? "(no name)"} | ${m.email} | role=${m.role}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
