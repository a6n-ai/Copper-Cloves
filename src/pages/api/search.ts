// src/pages/api/search.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { runSearch, type SearchRole } from "@/lib/search";

function toSearchRole(role: string | undefined): SearchRole | null {
  switch (role) {
    case "admin": return "admin";
    case "instructor": return "instructor";
    case "partner": return "partner";
    case "user": return "member";
    default: return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = await getStudioServerSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const u = session.user as { id?: string; role?: string; partner_id?: string | null; instructor_id?: string | null };
  const role = toSearchRole(u.role);
  if (!role || !u.id) return res.status(403).json({ error: "Forbidden" });

  const q = typeof req.query.q === "string" ? req.query.q : "";
  try {
    const groups = await runSearch(role, q, {
      userId: u.id,
      partnerId: u.partner_id ?? null,
      instructorId: u.instructor_id ?? null,
    });
    return res.status(200).json({ groups });
  } catch {
    // No PII in logs.
    console.error("search failed", { role, len: q.trim().length });
    return res.status(500).json({ error: "Search failed" });
  }
}
