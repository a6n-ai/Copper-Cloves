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
  "package.purchased": { category: "member", buildSummary: (m) => `Purchased ${str(m.package_name, "a package")}` },
  "profile.updated": { category: "member", buildSummary: () => "Updated profile" },
  "ticket.raised": { category: "member", buildSummary: () => "Raised a support request" },

  // admin
  "admin.payment_recorded": { category: "admin", buildSummary: (m) => `Recorded ${str(m.method, "a")} payment` },
  "admin.package_assigned": { category: "admin", buildSummary: (m) => `Assigned ${str(m.package_name, "a package")}` },
  "admin.badge_allocated": { category: "admin", buildSummary: (m) => `Allocated badge ${str(m.badge_name, "")}`.trim() },
  "admin.schedule_edited": { category: "admin", buildSummary: () => "Edited a class schedule" },

  // instructor / partner
  "instructor.member_checked_in": { category: "instructor", buildSummary: (m) => `Checked in ${str(m.member_name, "a member")}` },
  "instructor.self_check_in": { category: "instructor", buildSummary: () => "Self check-in" },
  "partner.booking_confirmed": { category: "partner", buildSummary: () => "Confirmed a booking" },
  "partner.booking_rejected": { category: "partner", buildSummary: () => "Rejected a booking" },
};

export function resolveAction(action: string, meta: Record<string, unknown>): {
  category: ActivityCategory;
  summary: string;
} {
  const def = ACTIVITY_ACTIONS[action];
  if (!def) return { category: "system", summary: action };
  return { category: def.category, summary: def.buildSummary(meta) };
}
