/**
 * `<picture>` / srcSet in Instructors assumed an Imgix-style CDN. Relative `/uploads/...`
 * and arbitrary HTTPS URLs do not support ?format=webp&width= — that yields broken images.
 */
export function supportsResponsivePicture(src: string | null | undefined): boolean {
  if (!src?.trim()) return false;
  const s = src.trim();
  if (s.startsWith("data:")) return false;
  if (s.startsWith("/")) return false;
  if (!s.startsWith("http://") && !s.startsWith("https://")) return false;
  try {
    const h = new URL(s).hostname.toLowerCase();
    return h.includes("imgix.net") || h.includes("cloudinary.com");
  } catch {
    return false;
  }
}
