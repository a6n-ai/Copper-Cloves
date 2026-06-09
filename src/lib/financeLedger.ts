import prisma from "@/lib/prisma";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/expenseConstants";
import type { ExpenseCategoryValue } from "@/lib/expenseConstants";

export type LedgerDirection = "credit" | "debit";

export interface LedgerEntry {
  id: string;
  direction: LedgerDirection;
  occurredAtISO: string;
  amountPaise: number;
  method: string | null;
  status: string;
  category: string;
  party: string;
  isManualExpense: boolean;
  reference: string | null;
  proofUrl: string | null;
  notes: string | null;
  recordedBy: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  bookingId: string | null;
  userPackageId: string | null;
}

export interface FinanceLedgerResult {
  entries: LedgerEntry[];
  totals: { creditPaise: number; debitPaise: number; netPaise: number };
  truncated: boolean;
}

const ledgerInclude = {
  profile: { select: { full_name: true, email: true, is_system: true } },
  instructor: { select: { name: true } },
  recorded_by_admin: { select: { full_name: true, email: true } },
} as const;

type LedgerRow = Awaited<ReturnType<typeof fetchRows>>[number];

function fetchRows(where: object, take: number) {
  return prisma.payment.findMany({
    where,
    orderBy: { created_at: "desc" },
    take,
    include: ledgerInclude,
  });
}

function creditCategory(r: LedgerRow): string {
  if (r.user_package_id) return "Package / pass";
  if (r.booking_id) return "Class booking";
  return "Payment";
}

function debitCategory(r: LedgerRow): string {
  const c = r.category as ExpenseCategoryValue | null;
  return (c && EXPENSE_CATEGORY_LABELS[c]) || "Expense";
}

function partyFor(r: LedgerRow): string {
  if (r.direction === "credit") {
    return r.profile?.full_name || r.profile?.email || "Member";
  }
  // debit: instructor (payout) → payee (vendor) → profile (system = "Studio")
  if (r.instructor?.name) return r.instructor.name;
  if (r.payee) return r.payee;
  if (r.profile?.is_system) return "The Studio";
  return r.profile?.full_name || r.profile?.email || "Studio";
}

function toEntry(r: LedgerRow): LedgerEntry {
  return {
    id: r.id,
    direction: r.direction as LedgerDirection,
    occurredAtISO: (r.incurred_at ?? r.created_at).toISOString(),
    amountPaise: r.amount_paise,
    method: r.method,
    status: r.status,
    category: r.direction === "credit" ? creditCategory(r) : debitCategory(r),
    party: partyFor(r),
    isManualExpense: r.is_manual_expense,
    reference: r.reference,
    proofUrl: r.proof_url,
    notes: r.notes,
    recordedBy: r.recorded_by_admin?.full_name ?? r.recorded_by_admin?.email ?? null,
    razorpayOrderId: r.razorpay_order_id,
    razorpayPaymentId: r.razorpay_payment_id,
    bookingId: r.booking_id,
    userPackageId: r.user_package_id,
  };
}

/**
 * Unified ledger: every Payment row (credit + debit), newest first.
 * `limit` caps rows returned; `truncated` signals more exist (no silent cap).
 */
export async function getFinanceLedger(
  opts: { from?: Date; to?: Date; limit?: number } = {},
): Promise<FinanceLedgerResult> {
  const limit = opts.limit ?? 250;
  const createdWindow =
    opts.from || opts.to ? { gte: opts.from, lt: opts.to } : undefined;
  const where = createdWindow ? { created_at: createdWindow } : {};

  const rows = await fetchRows(where, limit + 1);
  const truncated = rows.length > limit;
  const used = truncated ? rows.slice(0, limit) : rows;

  let creditPaise = 0;
  let debitPaise = 0;
  for (const r of used) {
    if (r.direction === "credit") creditPaise += r.amount_paise;
    else debitPaise += r.amount_paise;
  }

  return {
    entries: used.map(toEntry),
    totals: { creditPaise, debitPaise, netPaise: creditPaise - debitPaise },
    truncated,
  };
}
