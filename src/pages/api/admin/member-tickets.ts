import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!ensureAdmin(session, res)) return;

  if (req.method === "GET") {
    const tickets = await prisma.memberTicket.findMany({
      orderBy: { created_at: "desc" },
      include: {
        profile: { select: { email: true, full_name: true, phone: true } },
        user_package: {
          select: {
            pass_type: true,
            credits_remaining: true,
            expiration_date: true,
            is_active: true,
            package_type: { select: { name: true } },
          },
        },
      },
    });
    return res.json(tickets);
  }

  if (req.method === "PATCH") {
    const { id, status, admin_note } = req.body as { id: string; status?: string; admin_note?: string };
    if (!id) return res.status(400).json({ error: "id required" });

    const existing = await prisma.memberTicket.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Ticket not found" });

    const willResolvePause =
      status === "resolved" &&
      existing.status !== "resolved" &&
      existing.type === "pause_subscription" &&
      existing.pause_from &&
      existing.pause_to;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.memberTicket.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(admin_note !== undefined && { admin_note }),
        },
      });

      if (!willResolvePause) return { ticket: updated, packageUpdated: null };

      // Target the pass the member chose. Pre-selection tickets (null) fall back
      // to the most-recently-purchased active pass for backward compatibility.
      const pkg = existing.user_package_id
        ? await tx.userPackage.findFirst({
            where: { id: existing.user_package_id, user_id: existing.user_id },
          })
        : await tx.userPackage.findFirst({
            where: { user_id: existing.user_id, is_active: true },
            orderBy: { purchase_date: "desc" },
          });
      if (!pkg) return { ticket: updated, packageUpdated: null };

      const days = Math.max(
        1,
        Math.ceil((existing.pause_to!.getTime() - existing.pause_from!.getTime()) / DAY_MS),
      );
      const newExpiry = new Date(pkg.expiration_date.getTime() + days * DAY_MS);

      const packageUpdated = await tx.userPackage.update({
        where: { id: pkg.id },
        data: {
          is_paused: true,
          pause_start_date: existing.pause_from!,
          pause_end_date: existing.pause_to!,
          expiration_date: newExpiry,
        },
      });

      return { ticket: updated, packageUpdated };
    });

    return res.json(result);
  }

  res.status(405).end();
}
