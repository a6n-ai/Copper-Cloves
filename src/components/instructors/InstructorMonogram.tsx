import { instructorInitials } from "@/lib/instructorView";

/**
 * Branded fallback shown when an instructor has no photo. A warm sage-to-
 * terracotta wash with the person's initials in Playfair, so a missing image
 * still reads as part of the studio rather than a broken tile.
 */
export function InstructorMonogram({
  name,
  className = "",
  textClassName = "text-5xl",
}: {
  name: string;
  className?: string;
  textClassName?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex h-full w-full items-center justify-center bg-linear-to-br from-sage/25 via-cream to-terracotta/25 ${className}`}
    >
      <span className={`font-display font-normal tracking-tight text-charcoal/70 ${textClassName}`}>
        {instructorInitials(name)}
      </span>
    </div>
  );
}
