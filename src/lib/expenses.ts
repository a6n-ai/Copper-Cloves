import prisma from "@/lib/prisma";
import { getSystemProfileId } from "@/lib/systemProfile";
import type { ExpenseCategory, PaymentMethod } from "@/generated/prisma/client";

export { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/expenseConstants";

// Expenses are now Payment rows with direction "debit". This module is the one
// seam the rest of the app uses for expense reads/writes — repointing it onto
// Payment keeps every expense-consuming caller unchanged.
const expenseInclude = {
  instructor: { select: { name: true } },
  recorded_by_admin: { select: { full_name: true, email: true } },
} as const;

export type ExpenseWithRelations = Awaited<ReturnType<typeof listExpenses>>[number];

/** List expense (debit) rows, newest first. Optional half-open [start, end) window on incurred_at. */
export function listExpenses(opts?: { start?: Date; end?: Date }) {
  const incurred =
    opts?.start || opts?.end ? { gte: opts?.start, lt: opts?.end } : undefined;
  return prisma.payment.findMany({
    where: { direction: "debit", ...(incurred ? { incurred_at: incurred } : {}) },
    orderBy: { incurred_at: "desc" },
    include: expenseInclude,
  });
}

/** Sum of expense (debit) amounts (paise) in an optional [start, end) window. */
export async function sumExpensesPaise(opts?: { start?: Date; end?: Date }): Promise<number> {
  const incurred = opts?.start || opts?.end ? { gte: opts?.start, lt: opts?.end } : undefined;
  const agg = await prisma.payment.aggregate({
    _sum: { amount_paise: true },
    where: { direction: "debit", ...(incurred ? { incurred_at: incurred } : {}) },
  });
  return agg._sum.amount_paise ?? 0;
}

/** Create a manually-entered expense (café free meal, rent, ad-hoc cost, etc.). */
export async function createManualExpense(input: {
  category: ExpenseCategory;
  amountPaise: number;
  incurredAt?: Date;
  description?: string | null;
  payee?: string | null;
  method?: PaymentMethod | null;
  proofUrl?: string | null;
  notes?: string | null;
  recordedBy?: string | null;
}) {
  const systemId = await getSystemProfileId();
  return prisma.payment.create({
    data: {
      user_id: systemId,
      direction: "debit",
      status: "succeeded",
      currency: "INR",
      is_manual_expense: true,
      category: input.category,
      amount_paise: Math.round(input.amountPaise),
      incurred_at: input.incurredAt ?? new Date(),
      description: input.description ?? null,
      payee: input.payee ?? null,
      method: input.method ?? null,
      proof_url: input.proofUrl ?? null,
      notes: input.notes ?? null,
      recorded_by: input.recordedBy ?? null,
    },
    include: expenseInclude,
  });
}

export function deleteExpense(id: string) {
  // Guard on direction so this can only ever remove an expense (debit) row,
  // never a credit/income payment, even if an arbitrary id is passed.
  return prisma.payment.deleteMany({ where: { id, direction: "debit" } });
}

/**
 * Idempotently record an instructor payout as a debit row, keyed on
 * (instructor, period). user_id points at the instructor's login profile when
 * one exists, else the system Studio profile.
 */
export async function recordPayoutExpense(input: {
  instructorId: string;
  periodKey: string;
  amountPaise: number;
  incurredAt?: Date;
  payee?: string | null;
  method?: PaymentMethod | null;
  notes?: string | null;
  recordedBy?: string | null;
}) {
  const amount = Math.round(input.amountPaise);
  const instructor = await prisma.instructor.findUnique({
    where: { id: input.instructorId },
    select: { profile_id: true },
  });
  const userId = instructor?.profile_id ?? (await getSystemProfileId());
  return prisma.payment.upsert({
    where: {
      instructor_id_payout_period_key: {
        instructor_id: input.instructorId,
        payout_period_key: input.periodKey,
      },
    },
    create: {
      user_id: userId,
      direction: "debit",
      status: "succeeded",
      currency: "INR",
      is_manual_expense: false,
      category: "instructor_payout",
      amount_paise: amount,
      incurred_at: input.incurredAt ?? new Date(),
      payee: input.payee ?? null,
      method: input.method ?? null,
      notes: input.notes ?? null,
      recorded_by: input.recordedBy ?? null,
      instructor_id: input.instructorId,
      payout_period_key: input.periodKey,
    },
    update: {
      amount_paise: amount,
      method: input.method ?? undefined,
      payee: input.payee ?? undefined,
      recorded_by: input.recordedBy ?? undefined,
    },
    include: expenseInclude,
  });
}

/** Remove the auto-recorded payout debit row (e.g. when a payout is un-marked paid). */
export function removePayoutExpense(instructorId: string, periodKey: string) {
  return prisma.payment.deleteMany({
    where: { direction: "debit", instructor_id: instructorId, payout_period_key: periodKey },
  });
}
