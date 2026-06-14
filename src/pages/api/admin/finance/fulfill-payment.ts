import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";
import { sendBookingConfirmationEmail } from "@/lib/notifications/sendBookingEmail";
import { notifyPackagePurchase } from "@/lib/notifications/notifyPackagePurchase";
import logger from "@/lib/logger";
import { logActivity } from "@/lib/activityLog";
import { addMonths } from "date-fns";
import { SEAT_HOLDING_STATUSES, BOOKING_STATUS } from "@/lib/bookingStatus";
import { confirmPendingBookingTx } from "@/lib/confirmPendingBooking";

export type FulfillPaymentBody = {
  internalPaymentId: string;   // our Payment.id
  userId: string;
  intent: "booking" | "package";
  classScheduleId?: string;
  packageTypeId?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;
  if (req.method !== "POST") return res.status(405).end();

  const body = req.body as FulfillPaymentBody;
  const { internalPaymentId, userId, intent, classScheduleId, packageTypeId } = body;

  if (!internalPaymentId) return res.status(400).json({ error: "internalPaymentId required" });
  if (!userId) return res.status(400).json({ error: "userId required" });
  if (intent !== "booking" && intent !== "package") return res.status(400).json({ error: "intent must be booking | package" });
  if (intent === "booking" && !classScheduleId) return res.status(400).json({ error: "classScheduleId required" });
  if (intent === "package" && !packageTypeId) return res.status(400).json({ error: "packageTypeId required" });

  const existingPayment = await prisma.payment.findUnique({
    where: { id: internalPaymentId },
    select: { id: true, booking_id: true, user_package_id: true, amount_paise: true },
  });
  if (!existingPayment) return res.status(404).json({ error: "Payment not found." });
  if (intent === "booking" && existingPayment.booking_id) {
    return res.status(409).json({ error: "Booking already fulfilled for this payment." });
  }
  if (intent === "package" && existingPayment.user_package_id) {
    return res.status(409).json({ error: "Package already fulfilled for this payment." });
  }

  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!adminId) return res.status(401).json({ error: "Session user id missing." });

  try {
    const result = await prisma.$transaction(async (tx) => {
      let bookingId: string | null = null;
      let userPackageId: string | null = null;
      let newBooking = false;

      if (intent === "booking") {
        const pendingExisting = await tx.booking.findFirst({
          where: { user_id: userId, class_schedule_id: classScheduleId, status: BOOKING_STATUS.payment_pending },
          select: { id: true },
        });
        if (pendingExisting) {
          const r = await confirmPendingBookingTx(tx, pendingExisting.id);
          bookingId = r.bookingId;
          newBooking = r.transitioned;
        } else {
          const schedule = await tx.classSchedule.findUnique({
            where: { id: classScheduleId },
            include: {
              class_model: { select: { name: true } },
              bookings: { where: { status: { in: [...SEAT_HOLDING_STATUSES] } }, select: { id: true, user_id: true } },
            },
          });
          if (!schedule) throw Object.assign(new Error("Schedule not found"), { status: 404 });
          if (schedule.status === "cancelled") throw Object.assign(new Error("Class is cancelled"), { status: 400 });

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
                class_schedule_id: classScheduleId,
                status: "confirmed",
                class_name: schedule.class_model?.name ?? null,
                class_time: schedule.start_time.toISOString(),
              },
            });
            bookingId = booking.id;
            newBooking = true;
          }
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
            package_type_id: packageTypeId,
            credits_remaining: pkgType.is_unlimited ? null : (pkgType.class_count ?? null),
            credits_total: pkgType.is_unlimited ? null : (pkgType.class_count ?? null),
            expiration_date,
            is_active: true,
            pass_type: pkgType.type === "studio_pass" ? "studio_pass" : "class_pass",
          },
        });
        userPackageId = userPkg.id;
      }

      await tx.payment.update({
        where: { id: internalPaymentId },
        data: {
          user_id: userId,
          booking_id: bookingId,
          user_package_id: userPackageId,
          recorded_by: adminId,
        },
      });

      return { bookingId, userPackageId, newBooking };
    });

    if (intent === "booking" && result.bookingId && result.newBooking) {
      sendBookingConfirmationEmail(result.bookingId).catch((e) =>
        logger.error({ err: e }, "[fulfill-payment] booking email failed"),
      );
    }

    if (intent === "package" && result.userPackageId) {
      prisma.userPackage
        .findUnique({ where: { id: result.userPackageId }, include: { package_type: true } })
        .then((up) => {
          if (!up) return;
          return notifyPackagePurchase({ userId, packageType: up.package_type, expirationDate: up.expiration_date });
        })
        .catch((e) => logger.error({ err: e }, "[fulfill-payment] package notify failed"));
    }

    res.status(200).json({ bookingId: result.bookingId, userPackageId: result.userPackageId });

    logActivity({
      req,
      action: "admin.payment_fulfilled",
      targetProfileId: userId,
      entity: { type: "payment", id: internalPaymentId },
      metadata: { intent, booking_id: result.bookingId ?? undefined, user_package_id: result.userPackageId ?? undefined },
    });

    return;
  } catch (e: unknown) {
    const status = (e as { status?: number }).status;
    if (status) return res.status(status).json({ error: (e as Error).message });
    if ((e as { code?: string }).code === "P2002") return res.status(409).json({ error: "Already fulfilled." });
    logger.error({ err: e }, "[fulfill-payment]");
    return res.status(500).json({ error: "Fulfill failed." });
  }
}
