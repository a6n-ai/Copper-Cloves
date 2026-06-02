import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useInstructors } from "@/hooks/useInstructors";
import { Skeleton } from "@/components/ui/skeleton";
import { dedupeInstructorRows } from "@/lib/instructorIdentity";
import { toInstructorView, type InstructorView, type InstructorRowLike } from "@/lib/instructorView";
import { InstructorCard } from "@/components/instructors/InstructorCard";
import { InstructorDetailDialog } from "@/components/instructors/InstructorDetailDialog";
import { SectionHeading } from "@/components/SectionHeading";
import { CarouselControls } from "@/components/CarouselControls";
import { useCarouselScroll } from "@/hooks/useCarouselScroll";

const CARD_SIZES = "(max-width: 640px) 80vw, 280px";

/** Mirrors a row of the new instructor cards (portrait photo + name/title/meta). */
function InstructorsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-6 overflow-hidden pb-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[280px] shrink-0 overflow-hidden rounded-2xl border border-[#e5e4dc] bg-white-warm">
          <Skeleton className="aspect-[4/5] w-full rounded-none" />
          <div className="p-5">
            <Skeleton className="mb-2 h-7 w-3/4" />
            <Skeleton className="mb-3 h-3 w-1/2" />
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Instructors() {
  const { ref: scrollContainerRef, scrollBy, measure, atStart, atEnd, progress } = useCarouselScroll();
  const [selected, setSelected] = useState<InstructorView | null>(null);

  // Roster read through the shared SWR key (cached + deduped with the admin
  // pages and the /instructors route). Dedupe + map to display shape in render.
  const { data: instructorRows, isLoading } = useInstructors<InstructorRowLike[]>();
  const loading = isLoading && !instructorRows;
  const instructors: InstructorView[] = useMemo(
    () => dedupeInstructorRows(instructorRows ?? []).map(toInstructorView),
    [instructorRows],
  );

  // Re-sync control state once cards render (track size is child-driven).
  useEffect(() => {
    measure();
  }, [instructors, measure]);

  return (
    <section id="instructors" className="bg-cream py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="The Studio · People"
          title="Meet your instructors."
          subtitle="Trained experts who bring craft, precision, and heart to every class. Get to know the people who will guide your practice."
          accent="terracotta"
        />

        {/* Carousel */}
        <div className="mt-12">
          {loading ? (
            <InstructorsSkeleton count={3} />
          ) : instructors.length === 0 ? (
            <div className="rounded-2xl border border-[#e5e4dc] bg-white-warm py-16 text-center">
              <p className="font-body text-charcoal/60">No instructors found.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Edge fades hint more content and vanish at the boundaries */}
              <div
                className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-linear-to-r from-cream to-transparent transition-opacity duration-300 md:w-16 ${atStart ? "opacity-0" : "opacity-100"}`}
              />
              <div
                className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-cream to-transparent transition-opacity duration-300 md:w-16 ${atEnd ? "opacity-0" : "opacity-100"}`}
              />

              <div
                ref={scrollContainerRef}
                className="scrollbar-hide flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
              >
                {instructors.map((instructor, index) => (
                  <div
                    key={instructor.id ?? `${instructor.name}-${index}`}
                    className="w-[280px] shrink-0 snap-start"
                  >
                    <InstructorCard
                      instructor={instructor}
                      onOpen={setSelected}
                      sizes={CARD_SIZES}
                      priority={index < 4}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {!loading && instructors.length > 0 && (
          <CarouselControls
            className="mt-8"
            label="instructors"
            atStart={atStart}
            atEnd={atEnd}
            progress={progress}
            onPrev={() => scrollBy("left", 320)}
            onNext={() => scrollBy("right", 320)}
          />
        )}

        <div className="mt-10 text-center">
          <Link
            href="/instructors"
            className="group inline-flex items-center gap-1.5 font-body text-sm font-semibold text-sage transition-colors duration-200 hover:text-[#7A8B7C]"
          >
            Meet all instructors
            <ArrowRight
              size={16}
              className="transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        </div>
      </div>

      {selected && <InstructorDetailDialog instructor={selected} onClose={() => setSelected(null)} />}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
