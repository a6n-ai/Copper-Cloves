import { Badge } from "@/components/ui/badge";
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
      className="group block w-full overflow-hidden rounded-2xl border border-[#e5e4dc] bg-white-warm text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[#d8d3c4] hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
    >
      <div className="relative h-56 overflow-hidden">
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
        <Badge className="absolute left-3 top-3 border-0 bg-white-warm/90 text-xs text-sage">
          {classItem.category}
        </Badge>
        {classItem.instructor && (
          <div className="absolute -bottom-4 right-4 size-10 overflow-hidden rounded-full border-2 border-white-warm bg-linear-to-br from-terracotta/80 to-terracotta">
            {classItem.instructor.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={classItem.instructor.imageUrl}
                alt={classItem.instructor.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span aria-hidden="true" className="flex h-full w-full items-center justify-center font-display text-sm text-white-warm">
                {instructorInitial}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="p-5 pt-6">
        <h3 className="font-display text-2xl text-charcoal">{classItem.name}</h3>
        <p className="mt-1 font-body text-sm text-charcoal/55">
          {classItem.duration} min
          {classItem.instructor ? ` · with ${classItem.instructor.name}` : ""}
        </p>
        <span className="mt-3 inline-block font-body text-sm font-medium text-terracotta">
          View details →
        </span>
      </div>
    </button>
  );
}
