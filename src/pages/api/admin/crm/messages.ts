import type { NextApiRequest, NextApiResponse } from "next";
import { ensureAdmin } from "@/lib/requireAdmin";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import type { Prisma } from "@/generated/prisma/client";

// Whitelisted sort columns → Prisma orderBy. Relation sorts (recipient/template)
// go through the to-one relation. Anything else falls back to created_at.
function buildOrderBy(sort: string, dir: "asc" | "desc"): Prisma.CrmMessageOrderByWithRelationInput {
  switch (sort) {
    case "recipient":
      return { profile: { full_name: dir } };
    case "template":
      return { template: { name: dir } };
    case "channel":
      return { channel: dir };
    case "status":
      return { status: dir };
    default:
      return { created_at: dir };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;

  if (req.method === "GET") {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));
    const sort = String(req.query.sort ?? "created_at");
    const dir: "asc" | "desc" = req.query.dir === "asc" ? "asc" : "desc";

    const q = String(req.query.q ?? "").trim();
    const channel = String(req.query.channel ?? "").trim();
    const status = String(req.query.status ?? "").trim();

    const where: Prisma.CrmMessageWhereInput = {
      ...(channel ? { channel } : {}),
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { subject: { contains: q, mode: "insensitive" } },
              { profile: { is: { full_name: { contains: q, mode: "insensitive" } } } },
              { profile: { is: { email: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.crmMessage.findMany({
        where,
        include: {
          template: { select: { name: true } },
          profile: { select: { id: true, full_name: true, email: true } },
        },
        orderBy: buildOrderBy(sort, dir),
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.crmMessage.count({ where }),
    ]);

    const items = rows.map((m) => ({
      id: m.id,
      channel: m.channel,
      status: m.status,
      subject: m.subject,
      message_body: m.message_body,
      error_message: m.error_message,
      scheduled_for: m.scheduled_for,
      sent_at: m.sent_at,
      created_at: m.created_at,
      recipientName: m.profile?.full_name ?? null,
      recipientEmail: m.profile?.email ?? null,
      templateName: m.template?.name ?? null,
    }));

    return res.json({ items, page, total });
  }

  if (req.method === "POST") {
    const message = await prisma.crmMessage.create({ data: req.body });
    return res.status(201).json(message);
  }

  res.status(405).end();
}
