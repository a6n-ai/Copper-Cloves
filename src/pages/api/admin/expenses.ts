import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  EXPENSE_CATEGORIES,
  createManualExpense,
  deleteExpense,
  listExpenses,
  type ExpenseWithRelations,
} from "@/lib/expenses";
import type { ExpenseCategory, PaymentMethod } from "@/generated/prisma/client";

const PAYMENT_METHODS: PaymentMethod[] = [
  "razorpay_online",
  "razorpay_completed",
  "pine_lab_card",
  "pine_lab_upi",
  "direct_upi",
  "cash",
];

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return v.toString();
  return "";
}

function serialize(e: ExpenseWithRelations) {
  return {
    id: e.id,
    category: e.category,
    amountPaise: e.amount_paise,
    incurredAtISO: (e.incurred_at ?? e.created_at).toISOString(),
    description: e.description,
    payee: e.payee ?? e.instructor?.name ?? null,
    method: e.method,
    proofUrl: e.proof_url,
    notes: e.notes,
    instructorId: e.instructor_id,
    payoutPeriodKey: e.payout_period_key,
    isPayout: e.category === "instructor_payout",
    recordedBy: e.recorded_by_admin?.full_name ?? e.recorded_by_admin?.email ?? null,
  };
}

/**
 * Admin expense ledger.
 *   GET    → all expenses, newest first
 *   POST   → create a manual expense { category, amount (rupees), incurredAt?, description?, payee?, method?, proofUrl?, notes? }
 *   DELETE ?id= → remove an expense
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const adminId = (session.user as { id?: string }).id ?? null;

  if (req.method === "GET") {
    const rows = await listExpenses();
    return res.json({ expenses: rows.map(serialize) });
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const category = asString(body.category) as ExpenseCategory;
    if (!EXPENSE_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }
    // Amount comes in rupees from the form; store paise.
    const rupees = Number(body.amount);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }
    const method = body.method ? (asString(body.method) as PaymentMethod) : null;
    if (method && !PAYMENT_METHODS.includes(method)) {
      return res.status(400).json({ error: "Invalid method" });
    }
    let incurredAt: Date | undefined;
    if (body.incurredAt) {
      const d = new Date(asString(body.incurredAt));
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Invalid date" });
      incurredAt = d;
    }

    const created = await createManualExpense({
      category,
      amountPaise: Math.round(rupees * 100),
      incurredAt,
      description: body.description ? asString(body.description) : null,
      payee: body.payee ? asString(body.payee) : null,
      method,
      proofUrl: body.proofUrl ? asString(body.proofUrl) : null,
      notes: body.notes ? asString(body.notes) : null,
      recordedBy: adminId,
    });
    return res.status(201).json({ expense: serialize(created) });
  }

  if (req.method === "DELETE") {
    const id = String(req.query.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "id required" });
    await deleteExpense(id);
    return res.json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).end();
}
