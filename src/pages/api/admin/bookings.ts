/**
 * Admin all-bookings browser (read-only list): filterable/paginated view across every
 * booking, independent of the orphan/duplicate reconcile queue. Payment status per row is
 * derived from the linked Payment rows + booking.refund_status — not a stored column.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";
import { HISTORY_STATUSES, BOOKING_STATUS, type BookingStatus } from "@/lib/bookingStatus";
import type { Prisma } from "@/generated/prisma/client";

export type AdminBookingPaymentStatus = "paid" | "pending" | "refunded" | "none";

export type AdminBookingRow = {
  id: string;
  status: string;
  bookingDate: string;
  memberName: string | null;
  memberEmail: string | null;
  className: string | null;
  classStartTime: string | null;
  paymentStatus: AdminBookingPaymentStatus;
  amountPaise: number | null;
  razorpayPaymentId: string | null;
  invoiceAvailable: boolean;
  invoiceNumber: string | null;
  refundStatus: string | null;
  refundAmountPaise: number | null;
};

export type AdminBookingsResponse = {
  rows: AdminBookingRow[];
  total: number;
  page: number;
  pageSize: number;
};

const STATUS_FILTERS = new Set<string>([...HISTORY_STATUSES, "no_show"]);

function deriveRow(
  b: Prisma.BookingGetPayload<{
    include: {
      profile: { select: { full_name: true; email: true } };
      class_schedule: { select: { start_time: true; class_model: { select: { name: true } } } };
      payments: {
        select: {
          status: true;
          direction: true;
          amount_paise: true;
          razorpay_payment_id: true;
        };
      };
    };
  }>,
): AdminBookingRow {
  const succeededCredit = b.payments.find((p) => p.status === "succeeded" && p.direction === "credit");
  const anyRefunded = b.payments.some((p) => p.status === "refunded");
  const refundStatusActive = !!b.refund_status && b.refund_status !== "none";

  let paymentStatus: AdminBookingPaymentStatus;
  if (anyRefunded || refundStatusActive) {
    paymentStatus = "refunded";
  } else if (succeededCredit) {
    paymentStatus = "paid";
  } else if (b.status === BOOKING_STATUS.payment_pending) {
    paymentStatus = "pending";
  } else {
    paymentStatus = "none";
  }

  return {
    id: b.id,
    status: b.status,
    bookingDate: b.booking_date.toISOString(),
    memberName: b.profile?.full_name ?? null,
    memberEmail: b.profile?.email ?? null,
    className: b.class_schedule?.class_model?.name ?? b.class_name ?? null,
    classStartTime: b.class_schedule?.start_time?.toISOString() ?? null,
    paymentStatus,
    amountPaise: succeededCredit?.amount_paise ?? null,
    razorpayPaymentId: succeededCredit?.razorpay_payment_id ?? null,
    invoiceAvailable: !!succeededCredit,
    invoiceNumber: b.invoice_number ?? null,
    refundStatus: b.refund_status ?? null,
    refundAmountPaise: b.refund_amount_paise ?? null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;
  if (req.method !== "GET") return res.status(405).end();

  const statusQ = typeof req.query.status === "string" ? req.query.status : "all";
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  const page = Math.max(1, parseInt(typeof req.query.page === "string" ? req.query.page : "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(typeof req.query.pageSize === "string" ? req.query.pageSize : "25", 10) || 25),
  );

  const where: Prisma.BookingWhereInput = {};

  if (statusQ !== "all" && STATUS_FILTERS.has(statusQ)) {
    where.status = statusQ as BookingStatus | "no_show";
  }

  if (q) {
    where.OR = [
      { profile: { full_name: { contains: q, mode: "insensitive" } } },
      { profile: { email: { contains: q, mode: "insensitive" } } },
      { class_name: { contains: q, mode: "insensitive" } },
      { class_schedule: { class_model: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  if (from || to) {
    const startTime: Prisma.DateTimeFilter = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) startTime.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        startTime.lte = d;
      }
    }
    if (Object.keys(startTime).length) {
      where.class_schedule = { ...(where.class_schedule as object), start_time: startTime };
    }
  }

  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: {
        profile: { select: { full_name: true, email: true } },
        class_schedule: { select: { start_time: true, class_model: { select: { name: true } } } },
        payments: {
          select: { status: true, direction: true, amount_paise: true, razorpay_payment_id: true },
        },
      },
      orderBy: [{ class_schedule: { start_time: "desc" } }, { created_at: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const rows: AdminBookingRow[] = bookings.map(deriveRow);

  const response: AdminBookingsResponse = { rows, total, page, pageSize };
  return res.json(response);
}
