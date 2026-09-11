import prisma from "@/lib/prisma";

/**
 * Flip `is_active` off for passes whose expiry has passed.
 *
 * Read paths already re-check expiry live (`passIsActive`, the admin members
 * list's `activePkg` filter, etc.), so a stale `is_active: true` row rarely
 * shows as active — but a handful of call sites trust `is_active` alone
 * (see `src/pages/admin/members/[id].tsx` mapDetail's pre-fix fallback), and
 * new code can make the same mistake again. This cron closes the gap at the
 * source so `is_active` is never stale for long, instead of relying on every
 * reader to re-derive it.
 */
export function shouldExpire(pkg: { is_active: boolean; expiration_date: Date }, now: Date): boolean {
  if (!pkg.is_active) return false;
  return pkg.expiration_date.getTime() <= now.getTime();
}

export async function expireDuePasses(now: Date = new Date()) {
  const rows = await prisma.userPackage.findMany({
    where: { is_active: true, expiration_date: { lte: now } },
    select: { id: true, user_id: true, expiration_date: true, is_active: true },
  });
  const due = rows.filter((p) => shouldExpire(p, now));

  if (due.length === 0) return { expired: 0, ids: [] as string[] };

  const { count } = await prisma.userPackage.updateMany({
    where: { id: { in: due.map((p) => p.id) } },
    data: { is_active: false },
  });

  return { expired: count, ids: due.map((p) => p.id) };
}
