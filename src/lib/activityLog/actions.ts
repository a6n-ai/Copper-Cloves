export type ActivityCategory =
  | "auth"
  | "member"
  | "admin"
  | "instructor"
  | "partner"
  | "system";

export interface ActionDef {
  category: ActivityCategory;
  buildSummary: (meta: Record<string, unknown>) => string;
}

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.trim().length > 0 ? v : fallback;

/** Render a `metadata.changes` array as " — field: from → to, …" for summaries. */
export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}
function changeStr(m: Record<string, unknown>): string {
  const c = m.changes;
  if (!Array.isArray(c) || c.length === 0) return "";
  const parts = (c as FieldChange[])
    .map((x) => `${x.field}: ${x.from ?? "∅"} → ${x.to ?? "∅"}`)
    .join(", ");
  return ` — ${parts}`;
}

export const ACTIVITY_ACTIONS: Record<string, ActionDef> = {
  // auth
  "auth.login": { category: "auth", buildSummary: () => "Logged in" },
  "auth.logout": { category: "auth", buildSummary: () => "Logged out" },
  "auth.password_changed": { category: "auth", buildSummary: () => "Changed password" },
  "auth.password_reset": { category: "auth", buildSummary: () => "Reset password via email" },
  "auth.signup": { category: "auth", buildSummary: () => "Created account" },

  // member
  "booking.created": { category: "member", buildSummary: (m) => `Booked ${str(m.class_name, "a class")}` },
  "booking.cancelled": { category: "member", buildSummary: (m) => `Cancelled ${str(m.class_name, "a booking")}` },
  "booking.confirmed": { category: "member", buildSummary: (m) => `Booking confirmed for ${str(m.class_name, "a class")}${changeStr(m)}` },
  "booking.checked_in": { category: "member", buildSummary: (m) => `Checked in to ${str(m.class_name, "a class")} (${str(m.outcome, "on_time")})` },
  "booking.no_show": { category: "system", buildSummary: (m) => `No-show marked for ${str(m.class_name, "a class")}` },
  "booking.expired": { category: "system", buildSummary: (m) => `Unpaid hold released for ${str(m.class_name, "a class")}` },
  "booking.payment_reconciled": { category: "system", buildSummary: (m) => `Payment reconciled for ${str(m.class_name, "a class")}` },
  "booking.guest_added": { category: "member", buildSummary: (m) => `Guest added to ${str(m.class_name, "a class")}` },
  "package.purchased": { category: "member", buildSummary: (m) => `Purchased ${str(m.package_name, "a package")}` },
  "profile.updated": { category: "member", buildSummary: () => "Updated profile" },
  "ticket.raised": { category: "member", buildSummary: () => "Raised a support request" },

  // admin
  "admin.payment_recorded": { category: "admin", buildSummary: (m) => `Recorded ${str(m.method, "a")} payment` },
  "admin.payment_imported": { category: "admin", buildSummary: (m) => `Imported missing Razorpay payment ${str(m.payment_id, "")} (${str(m.intent, "record only")})`.trim() },
  "admin.payment_updated": { category: "admin", buildSummary: (m) => `Edited payment (${Array.isArray(m.changed_fields) ? (m.changed_fields as string[]).join(", ") : str(m.method, "fields")})` },
  "admin.payment_deleted": { category: "admin", buildSummary: () => `Deleted a manual payment` },
  "admin.package_assigned": { category: "admin", buildSummary: (m) => `Assigned ${str(m.package_name, "a package")}` },
  "admin.badge_allocated": { category: "admin", buildSummary: (m) => `Allocated badge ${str(m.badge_name, "")}`.trim() },
  "admin.schedule_created": {
    category: "admin",
    buildSummary: (m) =>
      typeof m.count === "number"
        ? `Created ${m.count} class schedule${m.count === 1 ? "" : "s"}`
        : `Created schedule for ${str(m.class_name, "a class")}`,
  },
  "admin.schedule_edited": {
    category: "admin",
    buildSummary: (m) => {
      const name = str(m.class_name, "a class");
      if (m.time_changed) return `Rescheduled ${name} (${str(m.old_time, "?")} → ${str(m.new_time, "?")})`;
      const fields = Array.isArray(m.changed_fields) ? (m.changed_fields as string[]).join(", ") : "";
      return fields ? `Edited ${name} (${fields})` : `Edited ${name}`;
    },
  },
  "admin.schedule_deleted": {
    category: "admin",
    buildSummary: (m) => `Deleted schedule for ${str(m.class_name, "a class")}`,
  },

  // instructor / partner
  "instructor.member_checked_in": { category: "instructor", buildSummary: (m) => `Checked in ${str(m.member_name, "a member")}` },
  "instructor.self_check_in": { category: "instructor", buildSummary: () => "Self check-in" },
  "partner.booking_confirmed": { category: "partner", buildSummary: () => "Confirmed a booking" },
  "partner.booking_rejected": { category: "partner", buildSummary: () => "Rejected a booking" },

  // system — outbound email audit (written directly by logEmailSent; listed here
  // so any activity UI categorizes it consistently).
  "notification.email_sent": {
    category: "system",
    buildSummary: (m) => `Email ${str(m.status, "sent")}: ${str(m.subject, "")}`.trim(),
  },
};

export function resolveAction(action: string, meta: Record<string, unknown>): {
  category: ActivityCategory;
  summary: string;
} {
  const def = ACTIVITY_ACTIONS[action];
  if (!def) return { category: "system", summary: action };
  return { category: def.category, summary: def.buildSummary(meta) };
}
