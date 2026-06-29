// Client-safe CRM template helpers. These intentionally DO NOT import the
// server-side `interpolateCrmTemplate` / `validateBodyVariables` (those modules
// pull `@/lib/prisma` into the bundle). The logic mirrors them exactly.

export interface CrmTemplate {
  id: string;
  name: string;
  template_key: string | null;
  is_system: boolean;
  subject: string | null;
  message_body: string;
  template_type: string;
  channel_whatsapp: boolean;
  channel_email: boolean;
  variables: string[];
  created_at: string;
}

const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g;
// camelCase token (lowercase-led, has an uppercase later) — the legacy style we warn against.
const CAMEL_RE = /^[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*$/;

/** Replace `{{Token}}` with the supplied value (or "" when absent). Mirrors the server. */
export function interpolate(body: string, vars: Record<string, string>): string {
  if (!body) return "";
  return body.replace(TOKEN_RE, (_m, key: string) => vars[key.trim()] ?? "");
}

/** Tokens used in `body` that are NOT in the declared (code-owned) palette. */
export function validateBodyVariables(body: string, allowed: readonly string[]): string[] {
  const used = [...body.matchAll(TOKEN_RE)].map((m) => m[1].trim());
  const set = new Set(allowed);
  return [...new Set(used.filter((u) => !set.has(u)))];
}

/** Distinct camelCase tokens present in the body (legacy — render empty in prod). */
export function camelCaseTokens(body: string): string[] {
  const used = [...body.matchAll(TOKEN_RE)].map((m) => m[1].trim());
  return [...new Set(used.filter((u) => CAMEL_RE.test(u)))];
}

// Sample values so the live preview never shows a blank field. Covers every
// Snake_Case token across the code-owned email kinds + legacy CRM variables.
export const SAMPLE_VARS: Record<string, string> = {
  Member_Name: "Priya Kapoor",
  Class_Name: "Hatha Yoga",
  Instructor_Name: "Vivek",
  Class_Date: "Monday, 20 May 2026",
  Class_Time: "7:00 PM – 8:00 PM",
  Start_Time: "7:00 PM",
  End_Time: "8:00 PM",
  Time_Range: "7:00 PM – 8:00 PM",
  Doors_Open: "6:45 PM",
  Duration: "60 min",
  Countdown: "1",
  Countdown_Unit: "hour",
  Studio_Link: "https://thestudiobycopperandcloves.in",
  Portal_Link: "https://thestudiobycopperandcloves.in/portal/dashboard",
  Dashboard_Link: "https://thestudiobycopperandcloves.in/instructor/dashboard",
  Refund_Detail: "A 1 Class Pass refund has been added to your account.",
  Refund_Roster:
    '<tr><td style="padding:6px 0;color:#2C2C2C">Priya Kapoor — 1 Class Pass returned</td></tr>',
  Credits_Count: "1",
  Credits_Remaining: "5",
  Headcount: "8",
  Capacity: "12",
  Spots_Left: "4",
  Roster_Rows:
    '<tr><td style="padding:6px 0;color:#2C2C2C">1. Priya Kapoor</td></tr><tr><td style="padding:6px 0;color:#2C2C2C">2. Arjun Mehta</td></tr>',
  First_Timer_Note:
    '<p style="font-size:14px;color:#7C9070;margin:0 0 12px">1 first-timer joining today.</p>',
  Email: "priya@example.com",
  Password: "TempPass1234",
  Temp_Password: "TempPass1234",
  Login_Link: "https://thestudiobycopperandcloves.in/login",
  Transaction_Id: "pay_PRb1aXyZ123",
  Amount_Paid: "₹800",
  Payment_Date: "Sunday, 19 May 2026",
  Old_Class_Date: "Monday, 20 May 2026",
  Old_Start_Time: "7:00 PM",
  New_Class_Date: "Tuesday, 21 May 2026",
  New_Start_Time: "8:00 AM",
  New_End_Time: "9:00 AM",
  Expiry_Date: "31 May 2026",
  Renewal_Link: "https://thestudiobycopperandcloves.in/portal/packages",
  Badge_Name: "Path to Mastery",
  Class_Count: "12",
  Last_Class_Attended: "Hatha Yoga",
};

/** Merge the canonical samples with any per-variable overrides the admin typed. */
export function sampleVarsFor(
  variables: readonly string[],
  overrides?: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...SAMPLE_VARS };
  for (const v of variables) if (!(v in out)) out[v] = `[${v}]`;
  if (overrides) for (const [k, val] of Object.entries(overrides)) if (val.trim()) out[k] = val;
  return out;
}

/** Wrap an interpolated body into a self-contained email document for the iframe. */
export function renderPreviewDoc(body: string, subject: string, vars: Record<string, string>): string {
  const renderedSubject = interpolate(subject, vars);
  const renderedBody = interpolate(body, vars);
  if (/<html|<!doctype/i.test(renderedBody)) return renderedBody;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${renderedSubject}</title></head><body style="font-family:Georgia,serif;margin:0;padding:16px;background:#F5F0E8;color:#2C2C2C">${renderedBody}</body></html>`;
}

// ── Grouping for the template list ──────────────────────────────────────────

export type CrmGroupKey = "booking" | "cancellation" | "reminders" | "account" | "other";

export interface CrmGroup {
  key: CrmGroupKey;
  label: string;
}

export const CRM_GROUPS: CrmGroup[] = [
  { key: "booking", label: "Booking" },
  { key: "cancellation", label: "Cancellation" },
  { key: "reminders", label: "Reminders & roster" },
  { key: "account", label: "Account & access" },
  { key: "other", label: "Other" },
];

export function groupForTemplate(t: CrmTemplate): CrmGroupKey {
  const key = (t.template_key ?? "").toLowerCase();
  const name = `${t.name} ${t.template_type}`.toLowerCase();
  if (/cancel/.test(key) || /cancel/.test(name)) return "cancellation";
  if (/booking|individual_class/.test(key) || /book/.test(name)) return "booking";
  if (/reminder|roster/.test(key) || /reminder|roster/.test(name)) return "reminders";
  if (/account|welcome|login|reset/.test(key) || /account|welcome|login/.test(name)) return "account";
  return "other";
}
