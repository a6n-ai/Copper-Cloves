import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";
import { sendBookingConfirmationEmail } from "@/lib/notifications/sendBookingEmail";
import { notifyPackagePurchase } from "@/lib/notifications/notifyPackagePurchase";
import logger from "@/lib/logger";
import { addMonths } from "date-fns";

export type ImportPaymentBody = {
  paymentId: string;
  amountPaise: number;
  razorpayMethod: string | null;
  createdAtISO: string;
  userId: string;
  intent: "none" | "booking" | "package";
  classScheduleId?: string;
  packageTypeId?: string;
  notes?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;
  if (req.method !== "POST") return res.status(405).end();

  const body = req.body as ImportPaymentBody;
  const { paymentId, amountPaise, razorpayMethod, createdAtISO, userId, intent, classScheduleId, packageTypeId, notes } = body;

  if (!paymentId || typeof paymentId !== "string") return res.status(400).json({ error: "paymentId required" });
  if (typeof amountPaise !== "number" || amountPaise <= 0) return res.status(400).json({ error: "amountPaise must be a positive number" });
  if (!userId || typeof userId !== "string") return res.status(400).json({ error: "userId required" });
  if (!["none", "booking", "package"].includes(intent)) return res.status(400).json({ error: "intent must be none | booking | package" });
  if (intent === "booking" && !classScheduleId) return res.status(400).json({ error: "classScheduleId required for booking intent" });
  if (intent === "package" && !packageTypeId) return res.status(400).json({ error: "packageTypeId required for package intent" });

  // Idempotent: don't double-import the same Razorpay payment
  const existing = await prisma.payment.findFirst({ where: { reference: paymentId } });
  if (existing) return res.status(409).json({ error: "Payment already imported.", existingId: existing.id });

  const existingByRzpId = await prisma.payment.findUnique({ where: { razorpay_payment_id: paymentId } });
  if (existingByRzpId) return res.status(409).json({ error: "Payment already recorded via online flow.", existingId: existingByRzpId.id });

  const adminId = (session!.user as { id: string }).id;
  const paymentCreatedAt = new Date(createdAtISO);

  try {
    const result = await prisma.$transaction(async (tx) => {
      let bookingId: string | null = null;
      let userPackageId: string | null = null;
      let newBooking = false;

      if (intent === "booking") {
        const schedule = await tx.classSchedule.findUnique({
          where: { id: classScheduleId },
          include: {
            class_model: { select: { name: true } },
            bookings: { where: { status: "confirmed" }, select: { id: true, user_id: true } },
          },
        });
        if (!schedule) throw Object.assign(new Error("Schedule not found"), { status: 404 });
        if (schedule.status === "cancelled") throw Object.assign(new Error("Class is cancelled"), { status: 400 });

        // If booking already exists for this member+schedule, link payment to it — don't duplicate
        const existingBooking = schedule.bookings.find((b) => b.user_id === userId);
        if (existingBooking) {
          bookingId = existingBooking.id;
        } else {
          if (schedule.capacity != null && schedule.bookings.length >= schedule.capacity) {
            throw Object.assign(new Error("Class is at full capacity"), { status: 400 });
          }
          const booking = await tx.booking.create({
            data: {
              user_id: userId,
              class_schedule_id: classScheduleId!,
              status: "confirmed",
              class_name: schedule.class_model?.name ?? null,
              class_time: schedule.start_time.toISOString(),
            },
          });
          bookingId = booking.id;
          newBooking = true;
        }
      }

      if (intent === "package") {
        const pkgType = await tx.packageType.findUnique({ where: { id: packageTypeId } });
        if (!pkgType) throw Object.assign(new Error("Package type not found"), { status: 404 });
        if (!pkgType.duration_months) throw Object.assign(new Error("Package type has no duration — cannot assign"), { status: 400 });
        const expiration_date = addMonths(new Date(), pkgType.duration_months);
        const userPkg = await tx.userPackage.create({
          data: {
            user_id: userId,
            package_type_id: packageTypeId!,
            credits_remaining: pkgType.is_unlimited ? null : (pkgType.class_count ?? null),
            credits_total: pkgType.is_unlimited ? null : (pkgType.class_count ?? null),
            expiration_date,
            is_active: true,
            pass_type: pkgType.type === "studio_pass" ? "studio_pass" : "class_pass",
          },
        });
        userPackageId = userPkg.id;
      }

      const payment = await tx.payment.create({
        data: {
          user_id: userId,
          booking_id: bookingId,
          user_package_id: userPackageId,
          method: "razorpay_completed",
          status: "succeeded",
          amount_paise: amountPaise,
          reference: paymentId,
          notes: [notes, razorpayMethod ? `rzp_method:${razorpayMethod}` : null].filter(Boolean).join(" | ") || null,
          recorded_by: adminId,
          created_at: paymentCreatedAt,
        },
      });

      return { payment, bookingId, userPackageId, newBooking };
    });

    // Send booking confirmation only for newly created bookings (not pre-existing ones)
    if (intent === "booking" && result.bookingId && result.newBooking) {
      sendBookingConfirmationEmail(result.bookingId).catch((e) =>
        logger.error({ err: e }, "[import-payment] booking email failed"),
      );
    }

    // Send package purchase notification (email + WhatsApp) — same as normal checkout flow
    if (intent === "package" && result.userPackageId) {
      prisma.userPackage
        .findUnique({
          where: { id: result.userPackageId },
          include: { package_type: true },
        })
        .then((up) => {
          if (!up) return;
          return notifyPackagePurchase({
            userId,
            packageType: up.package_type,
            expirationDate: up.expiration_date,
          });
        })
        .catch((e) => logger.error({ err: e }, "[import-payment] package notify failed"));
    }

    return res.status(201).json({
      paymentId: result.payment.id,
      bookingId: result.bookingId,
      userPackageId: result.userPackageId,
      linkedExistingBooking: result.bookingId != null && !result.newBooking,
    });
  } catch (e: unknown) {
    const status = (e as { status?: number }).status;
    if (status) return res.status(status).json({ error: (e as Error).message });
    // P2002 = unique constraint violation — concurrent double-import hit the DB guard
    if ((e as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "Payment already imported." });
    }
    logger.error({ err: e }, "[import-payment]");
    return res.status(500).json({ error: "Import failed." });
  }
}
