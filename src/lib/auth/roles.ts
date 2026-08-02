/**
 * The better-auth admin plugin stores roles in `user.role` as a
 * comma-separated string, so one identity can hold several. Order is PRIVILEGE
 * order (highest first) — it decides `primaryRole`, which drives the
 * post-login landing page. Copied from the retired portal-picker PORTAL_ORDER.
 */
export const STUDIO_ROLES = ["admin", "chef", "partner", "instructor", "user"] as const;

export type Role = (typeof STUDIO_ROLES)[number];

const VALID = new Set<string>(STUDIO_ROLES);

/** Split, normalise, drop anything unrecognised, dedupe, sort by privilege. */
export function parseRoles(raw: string | null | undefined): Role[] {
  if (!raw) return [];
  const found = new Set<Role>();
  for (const part of raw.split(",")) {
    const token = part.trim().toLowerCase();
    if (VALID.has(token)) found.add(token as Role);
  }
  return STUDIO_ROLES.filter((r) => found.has(r));
}

export function hasRole(raw: string | null | undefined, role: Role): boolean {
  return parseRoles(raw).includes(role);
}

/** Highest-privilege role held, or undefined. */
export function primaryRole(raw: string | null | undefined): Role | undefined {
  return parseRoles(raw)[0];
}

export function serializeRoles(roles: Role[]): string {
  return parseRoles(roles.join(",")).join(",");
}
