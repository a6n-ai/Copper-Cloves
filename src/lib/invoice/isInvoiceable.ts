/** A booking is invoiceable when it has ≥1 succeeded credit payment. */
export function isInvoiceable(
  payments: ReadonlyArray<{ status: string | null; direction: string | null }> | null | undefined,
): boolean {
  return !!payments?.some((p) => p.status === "succeeded" && p.direction === "credit");
}
