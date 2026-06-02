/** Up to two uppercase initials from a class name, for the image fallback panel. */
export function classInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "C";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Tailwind classes for the branded sage-gradient fallback panel (no terracotta — Two-Voice Rule). */
export const classFallbackGradient =
  "bg-linear-to-br from-sage/80 to-sage flex items-center justify-center";
