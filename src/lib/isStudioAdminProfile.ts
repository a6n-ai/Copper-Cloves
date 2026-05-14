/**
 * Studio admin login rows (credentials /admin). Everyone else counts as a member for stats & lists.
 * Uses string normalization so legacy NULL/odd `role` values still count as members.
 */
export function isStudioAdminProfileRole(role: string | null | undefined): boolean {
  return String(role ?? "").trim().toLowerCase() === "admin";
}
