import prisma from "@/lib/prisma";

/**
 * Flip passes back to active once their approved pause window has ended.
 *
 * Only ticket-approved pauses are auto-resumed — those carry a `pause_end_date`
 * and had their expiry extended up front (`api/admin/member-tickets.ts`), so
 * resuming must NOT extend again. Admin ad-hoc pauses store `pause_end_date =
 * null` (open-ended) and extend on manual resume; they are skipped here.
 *
 * Pause dates are kept after resume as history.
 */
/** Selection rule, mirrored by the query below and covered by test-resumeExpiredPauses.ts. */
export function shouldResume(
  pkg: { is_paused: boolean; pause_end_date: Date | null },
  now: Date,
): boolean {
  if (!pkg.is_paused) return false;
  if (!pkg.pause_end_date) return false; // open-ended admin pause — manual resume only
  return pkg.pause_end_date.getTime() <= now.getTime();
}

export async function resumeExpiredPauses(now: Date = new Date()) {
  const rows = await prisma.userPackage.findMany({
    where: { is_paused: true, pause_end_date: { not: null, lte: now } },
    select: { id: true, user_id: true, pause_end_date: true, is_paused: true },
  });
  const due = rows.filter((p) => shouldResume(p, now));

  if (due.length === 0) return { resumed: 0, ids: [] as string[] };

  const { count } = await prisma.userPackage.updateMany({
    where: { id: { in: due.map((p) => p.id) } },
    data: { is_paused: false },
  });

  return { resumed: count, ids: due.map((p) => p.id) };
}
