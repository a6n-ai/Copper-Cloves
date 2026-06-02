import { ArrowRight } from "lucide-react";
import { InstructorPhoto } from "@/components/instructors/InstructorPhoto";
import { InstructorMonogram } from "@/components/instructors/InstructorMonogram";
import type { InstructorView } from "@/lib/instructorView";

/**
 * Roster card used by both the homepage teaser carousel and the `/instructors`
 * grid. Flat at rest, lifts on hover — the photo (not the card) does the subtle
 * zoom, keeping motion to transform/opacity. The whole card is a button so it's
 * keyboard-reachable and announces as a single control.
 */
export function InstructorCard({
  instructor,
  onOpen,
  sizes,
  priority = false,
}: {
  instructor: InstructorView;
  onOpen: (instructor: InstructorView) => void;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(instructor)}
      aria-label={`View ${instructor.name}'s profile`}
      className="group/card flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#e5e4dc] bg-white-warm text-left transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-[#c8c6be] hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-sand">
        {instructor.hasImage ? (
          <InstructorPhoto
            src={instructor.image}
            name={instructor.name}
            sizes={sizes}
            priority={priority}
            className="transition-transform duration-500 ease-out group-hover/card:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          <InstructorMonogram name={instructor.name} textClassName="text-6xl" />
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-2xl leading-tight tracking-tight text-charcoal">
          {instructor.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 min-h-[2.4em] font-body text-xs font-semibold uppercase leading-[1.2] tracking-[0.08em] text-sage">
          {instructor.title}
        </p>

        {/* Reserved band so the View-profile baseline lines up across every card,
            regardless of how many specialties (or none) a person has. */}
        <div className="mt-3 flex min-h-[28px] flex-wrap gap-1.5">
          {instructor.specialties.length > 0
            ? instructor.specialties.slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-sage/25 bg-sage/10 px-2.5 py-1 font-body text-[11px] font-medium text-sage"
                >
                  {s}
                </span>
              ))
            : instructor.experience && (
                <span className="font-body text-sm italic text-charcoal/55">
                  {instructor.experience}
                </span>
              )}
        </div>

        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 font-body text-sm font-semibold text-terracotta/80 transition-colors duration-200 group-hover/card:text-terracotta">
          View profile
          <ArrowRight
            size={15}
            className="transition-transform duration-300 ease-out group-hover/card:translate-x-0.5 motion-reduce:transition-none"
          />
        </span>
      </div>
    </button>
  );
}
