/**
 * Shared CRM template rendering helpers.
 *
 * The old trigger-fan-out (`dispatchCrmEmailTriggers` / `dispatchCancellationEmails`
 * / `buildBookingCrmVariables`) has been retired — every outbound studio email now
 * routes through `sendStudioEmail` (`@/lib/notifications/email`), which owns the
 * variable contract per kind. Only the pure render helpers remain, still consumed
 * by the unified service and the admin CRM "send" endpoint.
 */

/**
 * Replace `{{Variable_Name}}` placeholders (CRM Template Architect style).
 */
export function interpolateCrmTemplate(template: string, variables: Record<string, string>): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key: string) => {
    const k = key.trim();
    return variables[k] ?? "";
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Admin HTML or plain text → safe-ish HTML for email. */
export function crmBodyToEmailHtml(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "<p></p>";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }
  const escaped = escapeHtml(trimmed).replace(/\r\n|\r|\n/g, "<br/>");
  return `<p style="margin:0 0 12px;">${escaped}</p>`;
}
