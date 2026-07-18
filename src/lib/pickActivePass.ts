/**
 * Choose which active pass a class booking deducts from. Prefer a finite
 * class_pass (credits_remaining != null), soonest-expiry first so short-lived
 * passes (e.g. a day pass) are spent before they lapse; fall back to an
 * unlimited pass (credits_remaining == null). Returns null when there is no
 * usable pass — callers treat that as "no active pass".
 *
 * Candidates must already be filtered to the member's active, unpaused,
 * unexpired, credit-bearing passes (the query does that); this is pure ranking.
 */
export function pickActivePass<T extends { credits_remaining: number | null; expiration_date: Date }>(
  candidates: readonly T[],
): T | null {
  const finite = candidates
    .filter((c) => c.credits_remaining != null)
    .sort((a, b) => a.expiration_date.getTime() - b.expiration_date.getTime());
  const unlimited = candidates.filter((c) => c.credits_remaining == null);
  return finite[0] ?? unlimited[0] ?? null;
}
