import prisma from "@/lib/prisma";
import type { ExpenseCategory, PaymentMethod } from "@/generated/prisma/client";

export { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/expenseConstants";

const expenseInclude = {
  instructor: { select: { name: true } },
  recorded_by_admin: { select: { full_name: true, email: true } },
} as const;

export type ExpenseWithRelations = Awaited<ReturnType<typeof listExpenses>>[number];

/** List expenses, newest first. Optional half-open [start, end) window on incurred_at. */
export function listExpenses(opts?: { start?: Date; end?: Date }) {
  const incurred =
    opts?.start || opts?.end ? { gte: opts?.start, lt: opts?.end } : undefined;
  return prisma.expense.findMany({
    where: incurred ? { incurred_at: incurred } : undefined,
    orderBy: { incurred_at: "desc" },
    include: expenseInclude,
  });
}

/** Sum of expense amounts (paise) in an optional [start, end) window. */
export async function sumExpensesPaise(opts?: { start?: Date; end?: Date }): Promise<number> {
  const incurred = opts?.start || opts?.end ? { gte: opts?.start, lt: opts?.end } : undefined;
  const agg = await prisma.expense.aggregate({
    _sum: { amount_paise: true },
    where: incurred ? { incurred_at: incurred } : undefined,
  });
  return agg._sum.amount_paise ?? 0;
}

/** Create a manually-entered expense (café free meal, rent, ad-hoc cost, etc.). */
export function createManualExpense(input: {
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
  return prisma.expense.create({
    data: {
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
  return prisma.expense.delete({ where: { id } });
}

/**
 * Idempotently record an instructor payout as an expense, keyed on
 * (instructor, period). Calling it again for the same period updates the amount
 * rather than creating a duplicate — so the payout screen and the expense tab
 * share one process and a payout can never be double-counted.
 */
export function recordPayoutExpense(input: {
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
  return prisma.expense.upsert({
    where: {
      instructor_id_payout_period_key: {
        instructor_id: input.instructorId,
        payout_period_key: input.periodKey,
      },
    },
    create: {
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

/** Remove the auto-recorded payout expense (e.g. when a payout is un-marked paid). */
export function removePayoutExpense(instructorId: string, periodKey: string) {
  return prisma.expense.deleteMany({
    where: { instructor_id: instructorId, payout_period_key: periodKey },
  });
}
