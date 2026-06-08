import { Pill } from "@/components/ui/pill";
import type { PublicInstructor } from "@/pages/classes";

export function InstructorStrip({ instructor }: { instructor: PublicInstructor }) {
  const initial = (instructor.name || "I").slice(0, 1).toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#e5e4dc] bg-cream p-3">
      {instructor.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={instructor.imageUrl}
          alt={instructor.name}
          className="size-11 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-terracotta/80 to-terracotta font-display text-lg text-white-warm">
          {initial}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-body text-sm font-semibold text-charcoal">{instructor.name}</p>
        {instructor.title && (
          <p className="font-body text-xs text-charcoal/55">{instructor.title}</p>
        )}
        {instructor.specialties.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {instructor.specialties.slice(0, 4).map((s) => (
              <Pill key={s} tone="success" size="sm">
                {s}
              </Pill>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
