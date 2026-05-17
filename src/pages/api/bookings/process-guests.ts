import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";

interface GuestInput {
  name: string;
  email: string;
  phone: string;
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
  guestName: string;
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
  guestName: string;
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const bookerName = (session.user as { name?: string }).name ?? "A member";

  const { guests, classScheduleId } = req.body as {
    guests?: GuestInput[];
    classScheduleId?: string;
  };

  if (!Array.isArray(guests) || guests.length === 0) {
    return res.status(200).json({ processed: 0 });
  }
  if (!classScheduleId) {
    return res.status(400).json({ error: "classScheduleId required" });
  }

  const schedule = await prisma.classSchedule.findUnique({
    where: { id: classScheduleId },
    include: {
      class_model: { select: { name: true } },
      instructor: { select: { name: true } },
    },
  });

  if (!schedule) return res.status(404).json({ error: "Class not found" });

  const baseUrl = process.env.NEXTAUTH_URL ?? `https://${req.headers.host}`;
  const classDate = formatClassDate(schedule.start_time.toISOString());
  const classTime = formatClassTime(schedule.start_time.toISOString());
  const className = schedule.class_model?.name ?? "Class";
  const instructor = schedule.instructor?.name ?? "Instructor";

  const results: { email: string; status: "new" | "existing" | "error" }[] = [];

  for (const guest of guests) {
    const email = guest.email.trim().toLowerCase();
    if (!email) continue;

    try {
      const existing = await prisma.profile.findUnique({ where: { email } });

      if (existing) {
        // Create booking for existing user if they don't already have one
        const duplicate = await prisma.booking.findFirst({
          where: {
            user_id: existing.id,
            class_schedule_id: classScheduleId,
            status: { in: ["confirmed", "pending"] },
          },
        });

        if (!duplicate) {
          await prisma.booking.create({
            data: {
              user_id: existing.id,
              class_schedule_id: classScheduleId,
              class_name: className,
              class_time: schedule.start_time.toISOString(),
              status: "confirmed",
              extra_guest_count: 0,
              finance_snapshot: {
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
              },
            },
          });
        }

        await sendHtmlEmail({
          to: email,
          subject: `${bookerName} booked a class with you — The Studio`,
          html: bookingNotificationEmail({
            guestName: existing.full_name ?? guest.name,
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
            full_name: guest.name.trim() || null,
            phone: guest.phone.trim() || null,
            hashedPassword,
            role: "user",
            onboarding_completed: false,
            user_stats: { create: {} },
          },
        });

        await prisma.booking.create({
          data: {
            user_id: newProfile.id,
            class_schedule_id: classScheduleId,
            class_name: className,
            class_time: schedule.start_time.toISOString(),
            status: "confirmed",
            extra_guest_count: 0,
            finance_snapshot: {
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
            },
          },
        });

        await sendHtmlEmail({
          to: email,
          subject: "Welcome to The Studio by Copper + Cloves",
          html: welcomeAndBookingEmail({
            guestName: guest.name,
            email,
            password,
            bookerName,
            className,
            classDate,
            classTime,
            instructor,
            loginUrl: `${baseUrl}/portal/login`,
          }),
        });

        results.push({ email, status: "new" });
      }
    } catch (err) {
      console.error("[process-guests] error for", email, err);
      results.push({ email, status: "error" });
    }
  }

  return res.status(200).json({ processed: results.length, results });
}
