import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

/**
 * Distinct members who have ATTENDED (checked in to) at least one of this partner's
 * classes, with how many sessions, their last session, and waiver status.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const sess = await getStudioServerSession(req, res);
  const user = sess?.user as { role?: string; partner_id?: string | null } | undefined;
  if (!user || user.role !== "partner" || !user.partner_id) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const partnerId = user.partner_id;

  const bookings = await prisma.booking.findMany({
    where: {
      checked_in: true,
      status: { not: "cancelled" },
      class_schedule: { is: { class_model: { is: { partner_id: partnerId } } } },
    },
    select: {
      check_in_time: true,
      class_schedule: { select: { start_time: true } },
      profile: { select: { id: true, full_name: true, email: true, phone: true } },
    },
  });

  type Row = {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    sessions: number;
    lastSession: string | null;
  };
  const byMember = new Map<string, Row>();
  for (const b of bookings) {
    const p = b.profile;
    const when = b.check_in_time ?? b.class_schedule?.start_time ?? null;
    const existing = byMember.get(p.id);
    if (existing) {
      existing.sessions += 1;
      if (when && (!existing.lastSession || when > new Date(existing.lastSession))) {
        existing.lastSession = when.toISOString();
      }
    } else {
      byMember.set(p.id, {
        id: p.id,
        name: p.full_name ?? p.email ?? "Member",
        email: p.email,
        phone: p.phone ?? null,
        sessions: 1,
        lastSession: when ? when.toISOString() : null,
      });
    }
  }

  const ids = Array.from(byMember.keys());
  const signed = ids.length
    ? await prisma.waiver.findMany({ where: { user_id: { in: ids } }, select: { user_id: true } })
    : [];
  const signedIds = new Set(signed.map((w) => w.user_id));

  const members = Array.from(byMember.values())
    .map((m) => ({ ...m, hasWaiver: signedIds.has(m.id) }))
    .sort((a, b) => (a.lastSession && b.lastSession ? (a.lastSession < b.lastSession ? 1 : -1) : 0));

  return res.json(members);
}
