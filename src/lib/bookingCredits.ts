/**
 * How many class credits one booking may spend from the booker's pass.
 *
 * The client picks between "just me" and "cover the whole group", but the
 * SERVER is authoritative: only two counts are ever legal — 1 (the booker's own
 * seat) or 1 + the number of added members actually being booked. This stops a
 * client from claiming an arbitrary credit count (or a ₹0 price) for a group it
 * isn't really booking.
 */
export function validateCreditsToDeduct(input: {
  requested: unknown;
  addedMemberCount: number;
}): { ok: boolean; credits?: number; error?: string } {
  const { requested, addedMemberCount } = input;
  if (requested === undefined || requested === null) return { ok: true, credits: 1 };
  if (typeof requested !== "number" || !Number.isInteger(requested) || requested < 1) {
    return { ok: false, error: "Invalid credits_to_deduct" };
  }
  const wholeGroup = 1 + Math.max(0, addedMemberCount);
  if (requested !== 1 && requested !== wholeGroup) {
    return { ok: false, error: "credits_to_deduct must be 1 or cover exactly the booked group" };
  }
  return { ok: true, credits: requested };
}
