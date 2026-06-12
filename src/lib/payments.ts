import prisma from "@/lib/prisma";
import { PaymentMethod, PaymentStatus } from "@/generated/prisma/client";

// The single seam for recording manual money-IN (offline / non-gateway member
// payments). Everything in the app that records a manual credit goes through
// recordManualPayment() — the sole exception is the Razorpay gateway path in
// razorpayPersistence.ts, which writes verified online credits, not manual ones.

/** Methods that mean "captured via Razorpay" — i.e. NOT manual money-in. */
export const RAZORPAY_METHODS: PaymentMethod[] = [
  PaymentMethod.razorpay_online,
  PaymentMethod.razorpay_completed,
];

/** Methods an admin may record by hand for offline money-in. */
export const MANUAL_PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.pine_lab_card,
  PaymentMethod.pine_lab_upi,
  PaymentMethod.direct_upi,
  PaymentMethod.cash,
];

/** Methods accepted by the record endpoint (manual + the completed-online flag). */
export const RECORDABLE_METHODS: PaymentMethod[] = [
  ...RAZORPAY_METHODS,
  ...MANUAL_PAYMENT_METHODS,
];

export type RecordManualPaymentInput = {
  user_id: string;
  user_package_id?: string | null;
  booking_id?: string | null;
  method: PaymentMethod;
  amount_paise: number;
  currency?: string | null;
  reference?: string | null;
  proof_url?: string | null;
  notes?: string | null;
  recorded_by?: string | null;
};

// Flat (non-discriminated) shape on purpose: this project runs strictNullChecks
// off, which breaks discriminated-union narrowing on `ok`. Callers check `ok`
// then read the optional fields directly.
export type RecordManualPaymentResult = {
  ok: boolean;
  error?: string;
  payment?: Awaited<ReturnType<typeof prisma.payment.create>>;
  replayed?: boolean;
};

/**
 * Record a manual money-in payment as a Payment row (direction "credit").
 *
 * Single canonical write path for manual income across the whole app. Validates
 * input and guards against double-submit (same user + method + amount + linkage
 * + reference within 5 minutes), mirroring the previous inline route logic.
 */
export async function recordManualPayment(
  input: RecordManualPaymentInput,
): Promise<RecordManualPaymentResult> {
  if (!input.user_id || typeof input.user_id !== "string") {
    return { ok: false, error: "user_id required" };
  }
  if (!RECORDABLE_METHODS.includes(input.method)) {
    return { ok: false, error: "Invalid method" };
  }
  const amount = Number(input.amount_paise);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "amount_paise must be non-negative integer" };
  }

  const amountPaise = Math.round(amount);
  const refNorm =
    typeof input.reference === "string" && input.reference.trim() ? input.reference.trim() : null;
  const upkgId = input.user_package_id || null;
  const bkId = input.booking_id || null;

  // Idempotency guard: covers double-submit (reload mid-request, double-click,
  // network retry, duplicate tab) within a short window.
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const existing = await prisma.payment.findFirst({
    where: {
      user_id: input.user_id,
      method: input.method,
      amount_paise: amountPaise,
      user_package_id: upkgId,
      booking_id: bkId,
      ...(refNorm ? { reference: refNorm } : {}),
      created_at: { gte: fiveMinAgo },
    },
    orderBy: { created_at: "desc" },
  });
  if (existing) {
    return { ok: true, payment: existing, replayed: true };
  }

  const payment = await prisma.payment.create({
    data: {
      direction: "credit",
      user_id: input.user_id,
      user_package_id: upkgId,
      booking_id: bkId,
      method: input.method,
      status: PaymentStatus.succeeded,
      amount_paise: amountPaise,
      currency: typeof input.currency === "string" && input.currency ? input.currency : "INR",
      reference: refNorm,
      proof_url: typeof input.proof_url === "string" ? input.proof_url : null,
      notes: typeof input.notes === "string" ? input.notes : null,
      recorded_by: input.recorded_by ?? null,
    },
  });
  return { ok: true, payment, replayed: false };
}

/** Guard: a row is an editable manual money-in iff credit AND not a Razorpay method. */
const MANUAL_CREDIT_WHERE = {
  direction: "credit" as const,
  OR: [{ method: null }, { method: { notIn: RAZORPAY_METHODS } }],
};

export type UpdateManualPaymentInput = {
  amount_paise?: number;
  method?: PaymentMethod | null;
  reference?: string | null;
  notes?: string | null;
};

/** One field-level change captured for the activity log. */
export type ManualPaymentChange = { field: string; from: unknown; to: unknown };

export type UpdateManualPaymentResult = {
  row: ManualPaymentInRow;
  changes: ManualPaymentChange[];
};

/**
 * Edit an admin-recorded manual money-in row. Guards on direction "credit" +
 * non-Razorpay method so a gateway payment can never be hand-edited. Returns the
 * updated row plus the per-field diff (old → new) so the caller can log each
 * edit, or null if no editable manual row matched the id.
 */
export async function updateManualPayment(
  id: string,
  input: UpdateManualPaymentInput,
): Promise<UpdateManualPaymentResult | null> {
  if (!id) return null;
  if (input.method != null && !MANUAL_PAYMENT_METHODS.includes(input.method)) {
    throw new Error("Invalid method");
  }

  // Load current values first so we can diff old → new for the audit log.
  const existing = await prisma.payment.findFirst({
    where: { id, ...MANUAL_CREDIT_WHERE },
    select: { amount_paise: true, method: true, reference: true, notes: true },
  });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  const changes: ManualPaymentChange[] = [];

  if (input.amount_paise !== undefined) {
    const amt = Number(input.amount_paise);
    if (!Number.isFinite(amt) || amt < 0) throw new Error("amount_paise must be non-negative");
    const next = Math.round(amt);
    if (next !== existing.amount_paise) {
      data.amount_paise = next;
      changes.push({ field: "amount_paise", from: existing.amount_paise, to: next });
    }
  }
  if (input.method !== undefined) {
    const next = input.method;
    if (next !== existing.method) {
      data.method = next;
      changes.push({ field: "method", from: existing.method, to: next });
    }
  }
  if (input.reference !== undefined) {
    const next =
      typeof input.reference === "string" && input.reference.trim() ? input.reference.trim() : null;
    if (next !== existing.reference) {
      data.reference = next;
      changes.push({ field: "reference", from: existing.reference, to: next });
    }
  }
  if (input.notes !== undefined) {
    const next = typeof input.notes === "string" && input.notes ? input.notes : null;
    if (next !== existing.notes) {
      data.notes = next;
      changes.push({ field: "notes", from: existing.notes, to: next });
    }
  }

  if (changes.length > 0) {
    await prisma.payment.updateMany({ where: { id, ...MANUAL_CREDIT_WHERE }, data });
  }
  const rows = await listManualPaymentsIn();
  const row = rows.find((r) => r.id === id);
  return row ? { row, changes } : null;
}

/** Delete an admin-recorded manual money-in row. Guarded to credit + non-Razorpay. */
export async function deleteManualPayment(id: string): Promise<boolean> {
  if (!id) return false;
  const res = await prisma.payment.deleteMany({ where: { id, ...MANUAL_CREDIT_WHERE } });
  return res.count > 0;
}

export type ManualPaymentInRow = {
  id: string;
  member: string;
  memberEmail: string | null;
  method: string | null;
  amountPaise: number;
  createdAtISO: string;
  reference: string | null;
  notes: string | null;
};

/** True if a manual (non-Razorpay) money-in already exists for this UserPackage. */
export async function manualCreditExistsForPackage(userPackageId: string): Promise<boolean> {
  if (!userPackageId) return false;
  const hit = await prisma.payment.findFirst({
    where: {
      user_package_id: userPackageId,
      direction: "credit",
      OR: [{ method: null }, { method: { notIn: RAZORPAY_METHODS } }],
    },
    select: { id: true },
  });
  return hit != null;
}

/**
 * List manual (non-Razorpay) money-in credits, newest first. "Manual" = any
 * credit row whose method is null OR not a Razorpay method. Drives the
 * Manual Entries → Money In tab.
 */
export async function listManualPaymentsIn(): Promise<ManualPaymentInRow[]> {
  const rows = await prisma.payment.findMany({
    where: {
      direction: "credit",
      // Prisma notIn drops null rows, so OR-in the null case explicitly.
      OR: [{ method: null }, { method: { notIn: RAZORPAY_METHODS } }],
    },
    orderBy: { created_at: "desc" },
    take: 200,
    select: {
      id: true,
      method: true,
      amount_paise: true,
      created_at: true,
      reference: true,
      notes: true,
      profile: { select: { full_name: true, email: true } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    member: p.profile?.full_name || p.profile?.email || "Member",
    memberEmail: p.profile?.email ?? null,
    method: p.method,
    amountPaise: p.amount_paise,
    createdAtISO: p.created_at.toISOString(),
    reference: p.reference,
    notes: p.notes,
  }));
}
