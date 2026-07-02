import prisma from "@/lib/prisma";
import { getStudioSettings, STUDIO_SETTINGS_ID } from "@/lib/studioSettings";
import type { InvoiceData, InvoiceLine } from "./types";

export class InvoiceNotPayableError extends Error {}

type SnapshotTotals = { classFeeInr: number; foodFeeInr: number; taxInr: number } | null;

/** Rupee amounts tolerate ±1 paise rounding when reconciling to the payment total. */
function readSnapshot(snap: unknown): SnapshotTotals {
  if (!snap || typeof snap !== "object") return null;
  const s = snap as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const classFeeInr = num(s.classFeeInr);
  const foodFeeInr = num(s.foodFeeInr);
  const taxInr = num(s.taxInr);
  if (classFeeInr === 0 && foodFeeInr === 0 && taxInr === 0) return null;
  return { classFeeInr, foodFeeInr, taxInr };
}

/**
 * Build reconciled line items. When the snapshot exists and its paise total
 * matches `totalPaise` (±2p), split into Class/Food lines + tax; otherwise emit
 * a single "Class booking" line so lines always reconcile to the authoritative
 * payment total. Exported for unit testing.
 */
export function reconcileLines(
  snap: SnapshotTotals,
  totalPaise: number,
): { lines: InvoiceLine[]; subtotalPaise: number; taxPaise: number } {
  if (snap) {
    const classP = Math.round(snap.classFeeInr * 100);
    const foodP = Math.round(snap.foodFeeInr * 100);
    const taxP = Math.round(snap.taxInr * 100);
    if (Math.abs(classP + foodP + taxP - totalPaise) <= 2) {
      const lines: InvoiceLine[] = [{ label: "Class booking", amountPaise: classP }];
      if (foodP > 0) lines.push({ label: "Café order", amountPaise: foodP });
      return { lines, subtotalPaise: classP + foodP, taxPaise: taxP };
    }
  }
  return {
    lines: [{ label: "Class booking", amountPaise: totalPaise }],
    subtotalPaise: totalPaise,
    taxPaise: 0,
  };
}

/** Lazily assign & persist a stable invoice number; reused on later downloads. */
async function ensureInvoiceNumber(bookingId: string): Promise<string> {
  await getStudioSettings(); // guarantees the singleton exists
  return prisma.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { id: bookingId }, select: { invoice_number: true } });
    if (b?.invoice_number) return b.invoice_number;
    const s = await tx.studioSettings.update({
      where: { id: STUDIO_SETTINGS_ID },
      data: { next_invoice_seq: { increment: 1 } },
      select: { next_invoice_seq: true, invoice_prefix: true },
    });
    const formatted = `${s.invoice_prefix}-${String(s.next_invoice_seq).padStart(6, "0")}`;
    await tx.booking.update({ where: { id: bookingId }, data: { invoice_number: formatted } });
    return formatted;
  });
}

export async function buildInvoiceData(bookingId: string): Promise<InvoiceData> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      class_name: true,
      class_time: true,
      finance_snapshot: true,
      class_schedule: { select: { start_time: true, class_model: { select: { name: true } } } },
      profile: { select: { full_name: true, email: true, phone: true } },
      payments: {
        where: { status: "succeeded", direction: "credit" },
        orderBy: { created_at: "asc" },
        select: { amount_paise: true, method: true, reference: true, created_at: true },
      },
    },
  });
  if (!booking) throw new InvoiceNotPayableError("Booking not found");
  const paid = booking.payments ?? [];
  if (paid.length === 0) throw new InvoiceNotPayableError("Booking has no completed payment");

  const totalPaise = paid.reduce((s, p) => s + (p.amount_paise ?? 0), 0);
  const { lines, subtotalPaise, taxPaise } = reconcileLines(readSnapshot(booking.finance_snapshot), totalPaise);

  const settings = await getStudioSettings();
  const invoiceNumber = await ensureInvoiceNumber(bookingId);
  const first = paid[0];

  return {
    invoiceNumber,
    issuedAt: new Date().toISOString(),
    business: {
      name: settings.business_name || "The Studio by Copper + Cloves",
      address: settings.business_address ?? null,
      gstin: settings.business_gstin ?? null,
      email: settings.business_email ?? null,
      phone: settings.business_phone ?? null,
      logoUrl: settings.business_logo_url ?? null,
      footerNote: settings.invoice_footer_note ?? null,
    },
    billTo: {
      name: booking.profile?.full_name || "Member",
      email: booking.profile?.email ?? null,
      phone: booking.profile?.phone ?? null,
    },
    booking: {
      className: booking.class_schedule?.class_model?.name || booking.class_name || "Class",
      classTime: (booking.class_schedule?.start_time ?? booking.class_time ?? null)?.toString() ?? null,
    },
    lines,
    subtotalPaise,
    taxPaise,
    totalPaise,
    payment: {
      method: first?.method ?? null,
      reference: first?.reference ?? null,
      paidAt: first?.created_at ? new Date(first.created_at).toISOString() : null,
    },
  };
}
