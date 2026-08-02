// src/pages/api/search.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { runSearch, type SearchRole } from "@/lib/search";
import { primaryRole, type Role } from "@/lib/auth/roles";

function toSearchRole(role: Role | undefined): SearchRole | null {
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
  if (!u.id) return res.status(403).json({ error: "Forbidden" });
  // Multi-role sessions carry a comma-separated string; search shows one
  // scope, so resolve to the highest-privilege role first.
  const role = toSearchRole(primaryRole(u.role));
  // Authenticated role without data search (e.g. kitchen/chef): return empty so the
  // client falls back to page-only search instead of showing an error banner.
  if (!role) return res.status(200).json({ groups: [] });

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
