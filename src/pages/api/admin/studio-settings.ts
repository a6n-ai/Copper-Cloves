/**
 * Admin studio-settings singleton (spec §4).
 *   GET → current StudioSettings (upsert-on-read defaults).
 *   PUT → update cancellation_cutoff_hours / default_package_validity_days /
 *         cancelled_pass_validity_days (each a positive integer).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getStudioSettings, STUDIO_SETTINGS_ID, STUDIO_SETTINGS_DEFAULTS } from "@/lib/studioSettings";
import { SHARE_PERCENT_MIN, SHARE_PERCENT_MAX } from "@/lib/sharedCredits";

/** Returns a positive integer or null if the value is missing/invalid. */
function posInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

const INT_FIELDS = [
  "cancellation_cutoff_hours",
  "default_package_validity_days",
  "cancelled_pass_validity_days",
] as const;

const STR_FIELDS = [
  "business_name",
  "business_address",
  "business_gstin",
  "business_email",
  "business_phone",
  "business_logo_url",
  "invoice_footer_note",
] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const settings = await getStudioSettings();
    return res.json({ settings });
  }

  if (req.method === "PUT") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const field of INT_FIELDS) {
      if (body[field] === undefined) continue;
      const val = posInt(body[field]);
      if (val === null) return res.status(400).json({ error: `${field} must be a positive integer` });
      data[field] = val;
    }

    for (const field of STR_FIELDS) {
      if (body[field] === undefined) continue;
      const v = body[field];
      if (v !== null && typeof v !== "string") return res.status(400).json({ error: `${field} must be a string` });
      // Empty string clears the field.
      (data as Record<string, unknown>)[field] = v === "" ? null : v;
    }
    // invoice_prefix is a non-nullable schema column (@default("INV")); unlike the
    // other STR_FIELDS, an empty/whitespace submit must fall back to the default
    // instead of coercing to null (which would trip a Prisma null-constraint 500).
    if (body.invoice_prefix !== undefined) {
      if (body.invoice_prefix !== null && typeof body.invoice_prefix !== "string") {
        return res.status(400).json({ error: "invoice_prefix must be a string" });
      }
      const raw = typeof body.invoice_prefix === "string" ? body.invoice_prefix.trim() : "";
      data.invoice_prefix = raw === "" ? "INV" : raw;
    }

    if (body.next_invoice_seq !== undefined) {
      const seq = posInt(body.next_invoice_seq);
      if (seq === null) return res.status(400).json({ error: "next_invoice_seq must be a positive integer" });
      (data as Record<string, unknown>)["next_invoice_seq"] = seq;
    }

    if (body.max_shared_percent !== undefined) {
      const pct = Number(body.max_shared_percent);
      if (!Number.isInteger(pct) || pct < SHARE_PERCENT_MIN || pct > SHARE_PERCENT_MAX) {
        return res.status(400).json({ error: `max_shared_percent must be an integer ${SHARE_PERCENT_MIN}–${SHARE_PERCENT_MAX}` });
      }
      data.max_shared_percent = pct;
    }

    const settings = await prisma.studioSettings.upsert({
      where: { id: STUDIO_SETTINGS_ID },
      update: data,
      create: { id: STUDIO_SETTINGS_ID, ...STUDIO_SETTINGS_DEFAULTS, ...data },
    });
    return res.json({ settings });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).end();
}
