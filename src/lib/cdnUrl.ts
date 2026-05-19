/**
 * Resolve a public asset path to its CDN URL.
 *
 * - In prod: prepends `NEXT_PUBLIC_CDN_URL` (CloudFront / S3 public URL).
 * - In dev (or when env unset): returns the path unchanged so Next.js serves
 *   from local public/.
 */
const CDN_BASE = (process.env.NEXT_PUBLIC_CDN_URL || "").replace(/\/$/, "");

export function cdnUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (!CDN_BASE) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${CDN_BASE}${clean}`;
}
