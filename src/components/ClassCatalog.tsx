import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useMemo, type ReactNode } from "react";

import { cdnUrl } from "@/lib/cdnUrl";
import { BLUR_DATA_URL, isUnoptimizableSrc } from "@/lib/imageBlur";
import { SectionHeading } from "@/components/SectionHeading";
import { CarouselControls } from "@/components/CarouselControls";
import { useCarouselScroll } from "@/hooks/useCarouselScroll";

interface ClassData {
  id?: string;
  name: string;
  benefit?: string;
  benefits?: string[];
  duration: string;
  image: string;
  image_url?: string;
}

/** Shown only when the database has no class types yet (landing still feels alive). */
const STATIC_CATALOG_FALLBACK: ClassData[] = [
  { name: "Muay Thai Circuit Training", duration: "55 min", image: cdnUrl("/muaythaicircuittraining.jpg"), benefit: "Power, speed, and conditioning" },
  { name: "Aerial Yoga", duration: "55 min", image: cdnUrl("/aerialyoga.jpg"), benefit: "Decompress and build core strength" },
  { name: "WARRIOR Strength", duration: "55 min", image: cdnUrl("/warriorstrength.jpg"), benefit: "Strength and cardio to music" },
  { name: "Mat Pilates", duration: "55 min", image: cdnUrl("/matpilates.jpg"), benefit: "Core-focused classical Pilates" },
];

/** Mirrors the horizontal row of class cards in the carousel. */
function ClassCatalogSkeleton({ count = 3 }: Readonly<{ count?: number }>) {
  const keys = useMemo(() => Array.from({ length: count }, () => crypto.randomUUID()), [count]);
  return (
    <div className="flex gap-6 overflow-hidden pb-4 px-2">
      {keys.map((key) => (
        <div
          key={key}
          className="relative h-80 w-[82vw] shrink-0 overflow-hidden rounded-2xl sm:w-80 md:h-96 md:w-96"
        >
          <Skeleton className="absolute inset-0 h-full w-full rounded-2xl" />
          <div className="absolute inset-x-0 bottom-0 space-y-2 p-6">
            <Skeleton className="h-8 w-3/4 bg-white-warm/30" />
            <Skeleton className="h-4 w-1/2 bg-white-warm/20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClassCatalog() {
  const { ref: scrollContainerRef, scrollBy, measure, atStart, atEnd, progress } = useCarouselScroll();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClasses();
  }, []);

  // Re-sync control state once cards render (track size is child-driven).
  useEffect(() => {
    measure();
  }, [classes, measure]);

  async function fetchClasses() {
    try {
      setLoading(true);
      const res = await fetch("/api/classes");
      const data = res.ok ? await res.json() : [];
      const transformedClasses: ClassData[] = data.map((cls: {
        id?: string; name: string; benefits?: string[]; duration: number; image_url?: string;
      }) => ({
        id: cls.id,
        name: cls.name,
        benefit: cls.benefits?.[0] || "",
        benefits: cls.benefits,
        duration: `${cls.duration} min`,
        image: cls.image_url || cdnUrl("/placeholder.jpg"),
        image_url: cls.image_url,
      }));
      setClasses(transformedClasses.length > 0 ? transformedClasses : STATIC_CATALOG_FALLBACK);
    } catch (error) {
      console.error("Error fetching classes:", error);
      setClasses(STATIC_CATALOG_FALLBACK);
    } finally {
      setLoading(false);
    }
  }

  let carouselBody: ReactNode;
  if (loading) {
    carouselBody = <ClassCatalogSkeleton count={3} />;
  } else if (classes.length === 0) {
    carouselBody = (
      <div className="py-12 text-center">
        <p className="font-body text-charcoal/60">No classes available at the moment.</p>
      </div>
    );
  } else {
    carouselBody = (
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
          className="scrollbar-hide flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-px-2 px-2 pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
        >
          {classes.map((classItem, index) => (
            <Link
              key={classItem.id || index}
              href="/classes"
              aria-label={`${classItem.name} — view the class schedule`}
              className="group/card relative block h-80 w-[82vw] shrink-0 snap-start overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-cream sm:w-80 md:h-96 md:w-96"
            >
              <Image
                src={classItem.image}
                alt={classItem.name}
                fill
                sizes="(max-width: 640px) 82vw, 384px"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                unoptimized={isUnoptimizableSrc(classItem.image)}
                className="object-cover transition-transform duration-500 ease-out group-hover/card:scale-105"
              />

              {/* Default state: gradient + name. Duration/benefit are visible by
                  default on touch (<md); on md+ they fade out so the centered
                  hover overlay can take over. */}
              <div className="absolute inset-0 flex flex-col items-start justify-end bg-linear-to-t from-charcoal/80 via-charcoal/40 to-transparent p-6 transition-opacity duration-500 ease-out md:group-hover/card:opacity-0">
                <h3 className="font-display text-2xl leading-tight text-cream drop-shadow-lg md:text-3xl">
                  {classItem.name}
                </h3>
                <div className="mt-2 flex items-center gap-2 text-cream/90 md:hidden">
                  <Clock size={16} />
                  <span className="font-body text-sm">{classItem.duration}</span>
                </div>
                {classItem.benefit && (
                  <p className="mt-1 font-body text-sm leading-relaxed text-cream/90 md:hidden">
                    {classItem.benefit}
                  </p>
                )}
              </div>

              {/* Hover state (md+ pointer devices only): centered details */}
              <div className="absolute inset-0 hidden flex-col items-center justify-center bg-charcoal/70 p-8 text-center opacity-0 transition-opacity duration-500 ease-out group-hover/card:opacity-100 md:flex">
                <h3 className="mb-3 font-display text-2xl text-cream drop-shadow-lg md:text-3xl">
                  {classItem.name}
                </h3>
                <div className="mb-3 flex items-center gap-2 text-cream/90">
                  <Clock size={18} />
                  <span className="font-body">{classItem.duration}</span>
                </div>
                <p className="font-body text-base leading-relaxed text-cream/90">
                  {classItem.benefit}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section id="classes" className="relative overflow-hidden bg-cream py-14 md:py-20">
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="The Studio · Classes"
          title="Our Classes"
          subtitle="Discover movement practices designed to challenge, restore, and transform."
          accent="terracotta"
        />

        {/* Carousel */}
        <div className="mt-10 md:mt-12">{carouselBody}</div>

        {!loading && classes.length > 0 && (
          <CarouselControls
            className="mt-8"
            label="classes"
            atStart={atStart}
            atEnd={atEnd}
            progress={progress}
            onPrev={() => scrollBy("left", 420)}
            onNext={() => scrollBy("right", 420)}
          />
        )}

        <div className="mt-10 text-center">
          <Link
            href="/classes"
            className="group inline-flex items-center gap-1.5 font-body text-sm font-semibold text-sage transition-colors duration-200"
          >
            See all classes
            <ArrowRight
              size={16}
              className="transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
