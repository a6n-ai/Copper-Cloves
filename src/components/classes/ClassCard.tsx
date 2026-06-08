import { Pill } from "@/components/ui/pill";
import { classInitials, classFallbackGradient } from "./classFallback";
import type { PublicClass } from "@/pages/classes";

export function ClassCard({
  classItem,
  onOpen,
}: {
  classItem: PublicClass;
  onOpen: (c: PublicClass) => void;
}) {
  const instructorInitial = (classItem.instructor?.name || "").slice(0, 1).toUpperCase();
  return (
    <button
      type="button"
      onClick={() => onOpen(classItem)}
      aria-label={`View details for ${classItem.name}`}
      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[#e5e4dc] bg-white-warm text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[#d8d3c4] hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
    >
      <div className="relative h-52 shrink-0 overflow-hidden sm:h-56">
        {classItem.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={classItem.imageUrl}
            alt={classItem.name}
            className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className={`h-full w-full ${classFallbackGradient}`} aria-hidden="true">
            <span className="font-display text-5xl text-white-warm/55">
              {classInitials(classItem.name)}
            </span>
          </div>
        )}
        <Pill tone="success" size="sm" className="absolute left-3 top-3 bg-white-warm/90">
          {classItem.category}
        </Pill>
        {classItem.instructor && (
          <>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-charcoal/85 via-charcoal/35 to-transparent"
              aria-hidden="true"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 p-3">
              <div className="size-9 shrink-0 overflow-hidden rounded-full border-2 border-white-warm/90 bg-linear-to-br from-terracotta/80 to-terracotta">
                {classItem.instructor.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={classItem.instructor.imageUrl}
                    alt={classItem.instructor.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-full w-full items-center justify-center font-display text-sm text-white-warm"
                  >
                    {instructorInitial}
                  </span>
                )}
              </div>
              <span className="font-body text-sm font-medium text-white-warm">
                {classItem.instructor.name}
              </span>
            </div>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-2xl leading-tight text-charcoal">{classItem.name}</h3>
        <p className="mt-1 font-body text-sm text-charcoal/55">{classItem.duration} min</p>
        <span className="mt-auto pt-4 font-body text-sm font-medium text-terracotta">
          View details →
        </span>
      </div>
    </button>
  );
}
