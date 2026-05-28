import prisma from "@/lib/prisma";
import logger from "@/lib/logger";

export type CrmTemplateKey =
  | "booking_confirmation"
  | "individual_class_booking"
  | "account_ready"
  | "cancellation_credit_returned"
  | "cancellation_no_credit";

export interface RenderedTemplate {
  subject: string;
  html: string;
  source: "db" | "fallback";
}

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function substitute(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, key) => {
    if (key in vars) return escapeHtml(vars[key]);
    return ""; // unknown placeholder → strip
  });
}

/**
 * Render a CRM template by key. Pulls latest version from DB so admin edits
 * in /admin/CRM take effect immediately. Falls back to caller-supplied
 * embedded HTML if the DB row is missing or empty.
 */
export async function renderCrmTemplate(
  key: CrmTemplateKey,
  vars: Record<string, unknown>,
  fallback: () => { subject: string; html: string }
): Promise<RenderedTemplate> {
  try {
    const row = await prisma.crmTemplate.findUnique({
      where: { template_key: key },
    });
    if (row && row.message_body) {
      return {
        subject: substitute(row.subject ?? "", vars),
        html: substitute(row.message_body, vars),
        source: "db",
      };
    }
  } catch (err) {
    logger.error({ err, key }, "[renderCrmTemplate] DB lookup failed");
  }
  const fb = fallback();
  return { subject: fb.subject, html: fb.html, source: "fallback" };
}
