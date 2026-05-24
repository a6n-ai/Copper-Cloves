import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

// One-off: onboard the guest (Hithaishi) recorded on Srushti Ruparel's booking
// who never got an account because payment completed via a Razorpay full-page
// redirect (root-cause fix: src/lib/guestOnboarding.ts wired into fulfillment).
//
// Robust to both booking shapes: booker row carrying the guest via
// `guest_attendees` JSON (current code) OR via `extra_guest_count > 0` (older).
// Idempotent — delegates to the same onboarding routine the app now uses.
// Run against the database that holds the booking (production).
const BOOKER_EMAIL = "srushti.ruparel18@gmail.com";
const GUEST = { name: "Hithaishi", email: "hithaishi.k99@gmail.com", phone: "9480752280" };

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const { onboardGuestsForBooking } = await import("../src/lib/guestOnboarding");

  const booker = await prisma.profile.findFirst({ where: { email: BOOKER_EMAIL, role: "user" } });
  if (!booker) throw new Error(`Booker not found (${BOOKER_EMAIL}). Are you connected to the right database?`);
  console.log("Booker:", booker.full_name ?? "(no name)", booker.id);

  // Find Srushti's booking that carries Hithaishi — match by guest_attendees
  // email first, then fall back to any row reserving extra guests.
  const candidates = await prisma.booking.findMany({
    where: { user_id: booker.id, status: { in: ["confirmed", "pending"] } },
    orderBy: { booking_date: "desc" },
    select: { id: true, class_schedule_id: true, class_name: true, extra_guest_count: true, guest_attendees: true },
  });

  const guestEmail = GUEST.email.trim().toLowerCase();
  const matchesGuest = (ga: unknown) =>
    Array.isArray(ga) &&
    ga.some((g) => g && typeof g === "object" && String((g as { email?: unknown }).email ?? "").trim().toLowerCase() === guestEmail);

  const bookerBooking =
    candidates.find((b) => matchesGuest(b.guest_attendees)) ??
    candidates.find((b) => (b.extra_guest_count ?? 0) > 0);

  if (!bookerBooking || !bookerBooking.class_schedule_id) {
    console.log("\nSrushti's recent bookings:");
    for (const b of candidates) console.log(`  - ${b.class_name} | sched=${b.class_schedule_id} | extra=${b.extra_guest_count} | guests=${JSON.stringify(b.guest_attendees)}`);
    throw new Error("Could not find the booking carrying Hithaishi (checked guest_attendees + extra_guest_count). Inspect the list above.");
  }
  console.log(`Target booking ${bookerBooking.id} (${bookerBooking.class_name}) on schedule ${bookerBooking.class_schedule_id}`);

  // Create account + roster row + welcome email (idempotent).
  const result = await onboardGuestsForBooking({
    guests: [GUEST],
    classScheduleId: bookerBooking.class_schedule_id,
    bookerId: booker.id,
  });
  console.log("Onboarding result:", JSON.stringify(result));

  // Avoid double-count: the guest now has their own seat row, so the booker
  // row must count as 1 (extra_guest_count 0). Only needed for the older shape.
  if ((bookerBooking.extra_guest_count ?? 0) > 0) {
    await prisma.booking.update({ where: { id: bookerBooking.id }, data: { extra_guest_count: 0 } });
    console.log("Reset booker extra_guest_count -> 0 on booking", bookerBooking.id);
  }

  await prisma.$disconnect();
  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
