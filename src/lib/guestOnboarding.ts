import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import type { GuestAttendee } from "@/lib/financeBookingCheckout";

/**
 * Server-side guest onboarding for class bookings.
 *
 * WHY this lives server-side: the booker's payment can complete via a full-page
 * Razorpay redirect (UPI / many mobile + netbanking methods). When that happens
 * the booking page unloads, so any client-side onboarding never runs. Guest
 * accounts must therefore be created wherever the booking is *fulfilled on the
 * server* — i.e. every checkout path converges here:
 *   - POST /api/bookings            (in-modal success, redirect-return with payload, free/credits)
 *   - finishBookingCheckoutOnServer (finish-checkout no-payload return + webhook)
 *
 * Idempotent: safe to call multiple times for the same booking (e.g. API + webhook).
 * Emails are sent ONLY when a new profile or a new guest roster row is created,
 * so re-runs never duplicate welcome/notification emails.
 *
 * Capacity-neutral: the booker's row already reserved `1 + guests` seats and
 * updated the schedule counters, so we only create the guests' own roster rows
 * here (each `extra_guest_count: 0`) — we do NOT touch schedule seat counters.
 */

interface OnboardResult {
  email: string;
  status: "new" | "existing" | "already_onboarded" | "error";
}

function generatePassword(length = 10): string {
  // Readable: no 0/O/l/1 confusion
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(length))
    .map((b) => chars[b % chars.length])
    .join("");
}

function formatClassDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatClassTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function welcomeAndBookingEmail(opts: {
  email: string;
  password: string;
  bookerName: string;
  className: string;
  classDate: string;
  classTime: string;
  instructor: string;
  loginUrl: string;
}): string {
  return `
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#2C2C2C">
      <h2 style="font-size:22px;margin-bottom:6px">Welcome to The Studio by Copper + Cloves!</h2>
      <p style="color:#666;margin-bottom:20px">
        <strong>${opts.bookerName}</strong> has invited you to join a class session.
        We've created an account for you so you can manage your bookings and explore everything The Studio has to offer.
      </p>

      <div style="background:#f5f7f3;border-radius:10px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 6px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.05em">Your Login Details</p>
        <p style="margin:0 0 4px"><strong>Email:</strong> ${opts.email}</p>
        <p style="margin:0 0 4px"><strong>Password:</strong> <code style="background:#e8ede4;padding:2px 6px;border-radius:4px;font-family:monospace">${opts.password}</code></p>
        <p style="margin:12px 0 0">
          <a href="${opts.loginUrl}"
             style="display:inline-block;background:#7C9070;color:#fff;padding:11px 28px;border-radius:999px;text-decoration:none;font-size:14px;font-family:Arial,sans-serif">
            Sign In to Your Account
          </a>
        </p>
        <p style="color:#999;font-size:12px;margin-top:10px">Please change your password after first login.</p>
      </div>

      <div style="border-left:3px solid #7C9070;padding-left:16px;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.05em">Your Upcoming Class</p>
        <p style="margin:0 0 4px;font-size:18px;font-weight:600">${opts.className}</p>
        <p style="margin:0 0 2px;color:#555">${opts.classDate}</p>
        <p style="margin:0 0 2px;color:#555">${opts.classTime}</p>
        ${opts.instructor !== "Instructor" ? `<p style="margin:0;color:#555">with ${opts.instructor}</p>` : ""}
      </div>

      <p style="color:#999;font-size:12px">See you on the mat!</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
      <p style="color:#bbb;font-size:12px">The Studio by Copper + Cloves</p>
    </div>
  `;
}

function bookingNotificationEmail(opts: {
  bookerName: string;
  className: string;
  classDate: string;
  classTime: string;
  instructor: string;
  portalUrl: string;
}): string {
  return `
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#2C2C2C">
      <h2 style="font-size:22px;margin-bottom:6px">You've been booked in!</h2>
      <p style="color:#666;margin-bottom:20px">
        <strong>${opts.bookerName}</strong> has booked a class with you at The Studio by Copper + Cloves.
      </p>

      <div style="border-left:3px solid #7C9070;padding-left:16px;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.05em">Class Details</p>
        <p style="margin:0 0 4px;font-size:18px;font-weight:600">${opts.className}</p>
        <p style="margin:0 0 2px;color:#555">${opts.classDate}</p>
        <p style="margin:0 0 2px;color:#555">${opts.classTime}</p>
        ${opts.instructor !== "Instructor" ? `<p style="margin:0;color:#555">with ${opts.instructor}</p>` : ""}
      </div>

      <p style="margin-bottom:20px">
        <a href="${opts.portalUrl}"
           style="display:inline-block;background:#7C9070;color:#fff;padding:11px 28px;border-radius:999px;text-decoration:none;font-size:14px;font-family:Arial,sans-serif">
          View in Your Dashboard
        </a>
      </p>

      <p style="color:#999;font-size:12px">See you on the mat!</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
      <p style="color:#bbb;font-size:12px">The Studio by Copper + Cloves</p>
    </div>
  `;
}

const GUEST_FINANCE_SNAPSHOT = {
  version: 1,
  classFeeInr: 0,
  foodFeeInr: 0,
  foodDiscountInr: 0,
  taxInr: 0,
  totalInr: 0,
  dayPassEquivalentCount: 0,
  noActivePackageCheckout: false,
  coveredByPrimaryBooker: true,
  paymentMethod: "studio",
} as const;

/**
 * Create accounts + roster rows + welcome/notification emails for a booking's
 * friends-&-family guests. Best-effort and idempotent; never throws (logs and
 * records per-guest errors instead) so it cannot fail the booker's fulfilled booking.
 */
export async function onboardGuestsForBooking(opts: {
  guests: GuestAttendee[];
  classScheduleId: string;
  bookerId: string;
}): Promise<{ processed: number; results: OnboardResult[] }> {
  const guests = (opts.guests ?? []).filter((g) => g.email && g.email.trim());
  if (guests.length === 0) return { processed: 0, results: [] };

  const schedule = await prisma.classSchedule.findUnique({
    where: { id: opts.classScheduleId },
    include: {
      class_model: { select: { name: true, partner_id: true } },
      instructor: { select: { name: true } },
    },
  });
  if (!schedule) return { processed: 0, results: [] };

  // Partner-run classes (e.g. Physique 57) await partner sign-off; guest rows
  // must mirror the booker's pending state rather than auto-confirming.
  const confirmationStatus = schedule.class_model?.partner_id ? "pending" : null;

  const booker = await prisma.profile.findUnique({
    where: { id: opts.bookerId },
    select: { full_name: true },
  });
  const bookerName = booker?.full_name ?? "A member";

  const baseUrl = process.env.NEXTAUTH_URL?.trim() || "";
  const classDate = formatClassDate(schedule.start_time.toISOString());
  const classTime = formatClassTime(schedule.start_time.toISOString());
  const className = schedule.class_model?.name ?? "Class";
  const instructor = schedule.instructor?.name ?? "Instructor";

  const results: OnboardResult[] = [];

  for (const guest of guests) {
    const email = guest.email!.trim().toLowerCase();
    if (!email) continue;

    try {
      const existing = await prisma.profile.findFirst({ where: { email, role: "user" } });

      if (existing) {
        const alreadyBooked = await prisma.booking.findFirst({
          where: {
            user_id: existing.id,
            class_schedule_id: opts.classScheduleId,
            status: { in: ["confirmed", "pending"] },
          },
        });
        // Idempotent: if the guest already has a roster row for this class, do
        // nothing (and crucially, send no duplicate email).
        if (alreadyBooked) {
          results.push({ email, status: "already_onboarded" });
          continue;
        }

        await prisma.booking.create({
          data: {
            user_id: existing.id,
            class_schedule_id: opts.classScheduleId,
            class_name: className,
            class_time: schedule.start_time.toISOString(),
            email,
            status: "confirmed",
            confirmation_status: confirmationStatus,
            extra_guest_count: 0,
            finance_snapshot: GUEST_FINANCE_SNAPSHOT,
          },
        });

        await sendHtmlEmail({
          to: email,
          subject: `${bookerName} booked a class with you — The Studio`,
          html: bookingNotificationEmail({
            bookerName,
            className,
            classDate,
            classTime,
            instructor,
            portalUrl: `${baseUrl}/portal/bookings`,
          }),
        });

        results.push({ email, status: "existing" });
      } else {
        const password = generatePassword(10);
        const hashedPassword = await bcrypt.hash(password, 12);

        const newProfile = await prisma.profile.create({
          data: {
            email,
            full_name: guest.name?.trim() || null,
            phone: guest.phone?.trim() || null,
            hashedPassword,
            role: "user",
            onboarding_completed: false,
          },
        });

        await prisma.booking.create({
          data: {
            user_id: newProfile.id,
            class_schedule_id: opts.classScheduleId,
            class_name: className,
            class_time: schedule.start_time.toISOString(),
            email,
            status: "confirmed",
            confirmation_status: confirmationStatus,
            extra_guest_count: 0,
            finance_snapshot: GUEST_FINANCE_SNAPSHOT,
          },
        });

        await sendHtmlEmail({
          to: email,
          subject: "Welcome to The Studio by Copper + Cloves",
          html: welcomeAndBookingEmail({
            email,
            password,
            bookerName,
            className,
            classDate,
            classTime,
            instructor,
            loginUrl: `${baseUrl}/login`,
          }),
        });

        results.push({ email, status: "new" });
      }
    } catch (err) {
      console.error("[onboardGuestsForBooking] error for", email, err);
      results.push({ email, status: "error" });
    }
  }

  return { processed: results.length, results };
}
