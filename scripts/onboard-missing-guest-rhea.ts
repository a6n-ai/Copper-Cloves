import { config } from "dotenv";
import { resolve } from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

// One-off: onboard the guest (Rhea Menon) who was recorded on Sitara Menon's
// booking but never got an account (booking predates the guest-processing fix).
const BOOKER_EMAIL = "smenon16@gmail.com";
const GUEST = { name: "Rhea Menon", email: "rheamenon8@gmail.com", phone: "9945516131" };

function generatePassword(length = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(length)).map((b) => chars[b % chars.length]).join("");
}

function welcomeEmail(o: { guestName: string; email: string; password: string; bookerName: string; className: string; classDate: string; classTime: string; loginUrl: string }): string {
  return `
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#2C2C2C">
      <h2 style="font-size:22px;margin-bottom:6px">Welcome to The Studio by Copper + Cloves!</h2>
      <p style="color:#666;margin-bottom:20px"><strong>${o.bookerName}</strong> booked a class with you. We've created an account so you can manage your bookings.</p>
      <div style="background:#f5f7f3;border-radius:10px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 6px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.05em">Your Login Details</p>
        <p style="margin:0 0 4px"><strong>Email:</strong> ${o.email}</p>
        <p style="margin:0 0 4px"><strong>Password:</strong> <code style="background:#e8ede4;padding:2px 6px;border-radius:4px;font-family:monospace">${o.password}</code></p>
        <p style="margin:12px 0 0"><a href="${o.loginUrl}" style="display:inline-block;background:#7C9070;color:#fff;padding:11px 28px;border-radius:999px;text-decoration:none;font-size:14px;font-family:Arial,sans-serif">Sign In to Your Account</a></p>
        <p style="color:#999;font-size:12px;margin-top:10px">Please change your password after first login.</p>
      </div>
      <div style="border-left:3px solid #7C9070;padding-left:16px;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.05em">Your Class</p>
        <p style="margin:0 0 4px;font-size:18px;font-weight:600">${o.className}</p>
        <p style="margin:0 0 2px;color:#555">${o.classDate}</p>
        <p style="margin:0 0 2px;color:#555">${o.classTime}</p>
      </div>
      <p style="color:#bbb;font-size:12px">The Studio by Copper + Cloves</p>
    </div>`;
}

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const { sendHtmlEmail } = await import("../src/lib/notifications/sendEmail");

  const booker = await prisma.profile.findFirst({ where: { email: BOOKER_EMAIL, role: "user" } });
  if (!booker) throw new Error("Booker not found");

  // Sitara's booking that carries Rhea as a guest.
  const bookerBooking = await prisma.booking.findFirst({
    where: { user_id: booker.id, extra_guest_count: { gt: 0 } },
    orderBy: { booking_date: "desc" },
    include: { class_schedule: { include: { class_model: true, instructor: true } } },
  });
  if (!bookerBooking || !bookerBooking.class_schedule_id) throw new Error("Booker guest-booking not found");

  const sched = bookerBooking.class_schedule!;
  const className = sched.class_model?.name ?? bookerBooking.class_name ?? "Class";
  const startIso = sched.start_time.toISOString();
  const classDate = sched.start_time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const classTime = sched.start_time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  const email = GUEST.email.trim().toLowerCase();
  let guestProfile = await prisma.profile.findFirst({ where: { email, role: "user" } });
  let password: string | null = null;

  if (guestProfile) {
    console.log("Guest profile already exists:", guestProfile.id);
  } else {
    password = generatePassword(10);
    const hashedPassword = await bcrypt.hash(password, 12);
    guestProfile = await prisma.profile.create({
      data: { email, full_name: GUEST.name, phone: GUEST.phone, hashedPassword, role: "user", onboarding_completed: false },
    });
    console.log("Created guest profile:", guestProfile.id);
  }

  // Rhea's own booking row (idempotent).
  const existingBooking = await prisma.booking.findFirst({
    where: { user_id: guestProfile.id, class_schedule_id: bookerBooking.class_schedule_id, status: { in: ["confirmed", "pending"] } },
  });
  if (existingBooking) {
    console.log("Guest booking already exists:", existingBooking.id);
  } else {
    const created = await prisma.booking.create({
      data: {
        user_id: guestProfile.id,
        class_schedule_id: bookerBooking.class_schedule_id,
        class_name: className,
        class_time: startIso,
        email,
        status: "confirmed",
        confirmation_status: bookerBooking.confirmation_status,
        extra_guest_count: 0,
        finance_snapshot: { version: 1, classFeeInr: 0, foodFeeInr: 0, foodDiscountInr: 0, taxInr: 0, totalInr: 0, dayPassEquivalentCount: 0, noActivePackageCheckout: false, coveredByPrimaryBooker: true, paymentMethod: "studio" },
      },
    });
    console.log("Created guest booking:", created.id);
  }

  // Avoid double-count: the guest now has their own row, so the booker counts as 1.
  if ((bookerBooking.extra_guest_count ?? 0) > 0) {
    await prisma.booking.update({ where: { id: bookerBooking.id }, data: { extra_guest_count: 0 } });
    console.log("Reset booker extra_guest_count -> 0 on booking", bookerBooking.id);
  }

  if (password) {
    const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://thestudiobycopperandcloves.in";
    await sendHtmlEmail({
      to: email,
      subject: "Welcome to The Studio by Copper + Cloves",
      html: welcomeEmail({ guestName: GUEST.name, email, password, bookerName: booker.full_name ?? "Sitara Menon", className, classDate, classTime, loginUrl: `${baseUrl}/login` }),
    });
    console.log(`Sent welcome email to ${email}`);
  } else {
    console.log("No password generated (profile pre-existed) — no email sent.");
  }

  await prisma.$disconnect();
  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
