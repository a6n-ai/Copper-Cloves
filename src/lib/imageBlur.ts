/**
 * Shared low-cost blur placeholder for `next/image` on dynamic/remote sources
 * (S3 URLs, DB-driven catalog images) where Next can't auto-generate a blur from
 * a static import. A neutral warm-grey matching the site's cream palette so the
 * fade-in reads as "loading", not "broken". Tiny 8×8 webp, inlined.
 */
export const BLUR_DATA_URL =
  "data:image/webp;base64,UklGRigAAABXRUJQVlA4IBwAAABwAQCdASoIAAgAA4BaJZwCdAFAAAD+8kPf7wAA";

/** True when a src can't go through the Next optimizer (data: URLs aren't supported). */
export function isUnoptimizableSrc(src: string | null | undefined): boolean {
  return !!src && src.startsWith("data:");
}
