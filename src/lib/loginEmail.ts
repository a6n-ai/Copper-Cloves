/** Normalize email for lookup/login (trim, lower-case, strip stray trailing dots). */
export function normalizeLoginEmail(email: string): string {
  let e = email.trim().toLowerCase();
  while (e.endsWith(".")) e = e.slice(0, -1);
  return e;
}
