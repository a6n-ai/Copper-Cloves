import { useState } from "react";

type InstructorAvatarProps = {
  src?: string | null;
  name: string;
  /** Tailwind classes for the fallback box (should fill the frame, e.g. h-full w-full) */
  className?: string;
  imgClassName?: string;
};

/**
 * Instructor headshot with initials fallback when URL is missing or fails to load
 * (common on serverless when rows point at /uploads/... that does not exist on the host).
 */
export function InstructorAvatar({
  src,
  name,
  className = "h-full w-full",
  imgClassName = "",
}: InstructorAvatarProps) {
  const [broken, setBroken] = useState(false);
  const url = src?.trim();

  if (!url || broken) {
    const initials =
      name
        .split(/\s+/)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?";
    return (
      <div className={`flex items-center justify-center bg-sage/15 ${className}`}>
        <span className="font-display text-sm font-medium text-sage" aria-hidden>
          {initials}
        </span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      className={`w-full h-full object-cover ${imgClassName}`.trim()}
      onError={() => setBroken(true)}
    />
  );
}
