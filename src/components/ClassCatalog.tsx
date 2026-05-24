import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Clock } from "lucide-react";
import { useRouter } from "next/router";
import { useRef, useState, useEffect } from "react";

import { cdnUrl } from "@/lib/cdnUrl";
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

/** Mirrors the horizontal row of full-bleed class cards in the carousel. */
function ClassCatalogSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-6 overflow-hidden pb-4 px-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative shrink-0 w-88 sm:w-96 h-104 md:h-128 rounded-2xl overflow-hidden"
        >
          <Skeleton className="absolute inset-0 w-full h-full rounded-2xl" />
          {/* Name placeholder anchored to bottom, matching the default overlay */}
          <div className="absolute inset-x-0 bottom-0 p-6 space-y-2">
            <Skeleton className="h-9 w-3/4 bg-white/30" />
            <Skeleton className="h-4 w-1/2 bg-white/20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClassCatalog() {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClasses();
  }, []);

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

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400;
      const newScrollPosition = 
        scrollContainerRef.current.scrollLeft + (direction === "left" ? -scrollAmount : scrollAmount);
      scrollContainerRef.current.scrollTo({
        left: newScrollPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <section id="classes" className="py-14 md:py-16 bg-cream relative overflow-hidden">
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-sage blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl md:text-5xl text-charcoal mb-4">
            Our Classes
          </h2>
          <p className="font-body text-lg text-charcoal/60 max-w-2xl mx-auto">
            Discover movement practices designed to challenge, restore, and transform
          </p>
        </div>

        {/* Carousel Container */}
        <div className="relative">
          {/* Left Scroll Button */}
          <button
            onClick={() => scroll("left")}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 w-12 h-12 rounded-full bg-white/80 backdrop-blur-md border border-sage/20 items-center justify-center hover:bg-white hover:scale-110 transition-all duration-600 ease-in-out shadow-lg"
            aria-label="Scroll left"
          >
            <svg className="w-6 h-6 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Right Scroll Button */}
          <button
            onClick={() => scroll("right")}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 w-12 h-12 rounded-full bg-white/80 backdrop-blur-md border border-sage/20 items-center justify-center hover:bg-white hover:scale-110 transition-all duration-600 ease-in-out shadow-lg"
            aria-label="Scroll right"
          >
            <svg className="w-6 h-6 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Carousel Scroll Container */}
          {loading ? (
            <div className="w-full py-4">
              <ClassCatalogSkeleton count={3} />
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-body text-charcoal/60">No classes available at the moment.</p>
            </div>
          ) : (
            <div 
              ref={scrollContainerRef}
              className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-4 px-2"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {classes.map((classItem, index) => (
                <div
                  key={classItem.id || index}
                  className="group relative shrink-0 w-88 sm:w-96 h-104 md:h-128 rounded-2xl overflow-hidden cursor-pointer"
                >
                  {/* Background Image */}
                  <img
                    src={classItem.image}
                    alt={classItem.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-600 ease-in-out group-hover:scale-110"
                  />

                  {/* Default State - Dark gradient with class name */}
                  <div className="absolute inset-0 bg-linear-to-t from-charcoal/80 via-charcoal/40 to-transparent transition-opacity duration-600 ease-in-out group-hover:opacity-0 flex items-end p-6">
                    <h3 className="font-display text-3xl md:text-4xl text-white drop-shadow-lg leading-tight">
                      {classItem.name}
                    </h3>
                  </div>

                  {/* Hover State - Glassmorphism overlay with details */}
                  <div className="absolute inset-0 bg-white/10 backdrop-blur-[10px] opacity-0 group-hover:opacity-100 transition-all duration-600 ease-in-out flex flex-col items-center justify-center p-8 text-center">
                    <h3 className="font-display text-3xl md:text-4xl text-white mb-4 drop-shadow-lg">
                      {classItem.name}
                    </h3>
                    
                    <div className="flex items-center gap-2 text-white/90 mb-4">
                      <Clock size={18} />
                      <span className="font-body">{classItem.duration}</span>
                    </div>

                    <p className="font-body text-lg text-white/90 leading-relaxed">
                      {classItem.benefit}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA Button */}
        <div className="text-center mt-8 md:mt-10">
          <Button
            onClick={() => router.push("/classes")}
            size="lg"
            variant="outline"
            className="border-2 border-sage text-sage hover:bg-sage hover:text-white bg-cream transition-all duration-600 ease-in-out px-8 group"
          >
            Explore All Classes
            <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform duration-600 ease-in-out" size={18} />
          </Button>
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