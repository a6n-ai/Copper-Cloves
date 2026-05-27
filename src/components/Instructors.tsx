import { useRef, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/quick-actions";
import { ChevronLeft, ChevronRight, X, Award, Calendar, Heart, Share2, Facebook, Twitter, Linkedin, MessageCircle } from "lucide-react";
import Link from "next/link";
import { supportsResponsivePicture } from "@/lib/imageDelivery";
import { dedupeInstructorRows } from "@/lib/instructorIdentity";

import { cdnUrl } from "@/lib/cdnUrl";
interface Instructor {
  id?: string;
  name: string;
  title: string;
  experience?: string;
  years_of_experience?: number;
  about: string;
  image: string;
  image_url?: string;
  specialties: string[];
  certifications: string[];
  philosophy: string;
  social_facebook?: string;
  social_twitter?: string;
  social_linkedin?: string;
  social_whatsapp?: string;
}

function instructorObjectPositionClass(name: string): string {
  return name === "Shruti" || name === "Siddhartha" ? "object-top-right" : "object-top";
}

function InstructorCarouselPhoto({
  src,
  name,
  index,
  onLoad,
  onError,
}: {
  src: string;
  name: string;
  index: number;
  onLoad: () => void;
  onError: () => void;
}) {
  const pos = instructorObjectPositionClass(name);
  const imgClass = `w-full h-full object-cover transition-all duration-700 ${pos}`;

  if (supportsResponsivePicture(src)) {
    return (
      <picture>
        <source
          srcSet={`${src}?format=webp&width=320 320w, ${src}?format=webp&width=640 640w, ${src}?format=webp&width=1200 1200w`}
          sizes="(max-width: 640px) 320px, (max-width: 1200px) 640px, 1200px"
          type="image/webp"
        />
        <source
          srcSet={`${src}?width=320 320w, ${src}?width=640 640w, ${src}?width=1200 1200w`}
          sizes="(max-width: 640px) 320px, (max-width: 1200px) 640px, 1200px"
        />
        <img
          src={src}
          alt={name}
          loading={index < 4 ? "eager" : "lazy"}
          onLoad={onLoad}
          onError={onError}
          className={imgClass}
          style={{ willChange: "transform, opacity" }}
        />
      </picture>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      loading={index < 4 ? "eager" : "lazy"}
      onLoad={onLoad}
      onError={onError}
      className={imgClass}
      style={{ willChange: "transform, opacity" }}
    />
  );
}

function InstructorModalPhoto({ src, name }: { src: string; name: string }) {
  const pos = instructorObjectPositionClass(name);
  const imgClass = `w-full h-full object-cover ${pos}`;

  if (supportsResponsivePicture(src)) {
    return (
      <picture>
        <source
          srcSet={`${src}?format=webp&width=320 320w, ${src}?format=webp&width=640 640w, ${src}?format=webp&width=1200 1200w`}
          sizes="(max-width: 640px) 320px, (max-width: 1200px) 640px, 1200px"
          type="image/webp"
        />
        <source
          srcSet={`${src}?width=320 320w, ${src}?width=640 640w, ${src}?width=1200 1200w`}
          sizes="(max-width: 640px) 320px, (max-width: 1200px) 640px, 1200px"
        />
        <img src={src} alt={name} className={imgClass} />
      </picture>
    );
  }

  return <img src={src} alt={name} className={imgClass} />;
}

/** Mirrors the horizontal row of instructor cards (photo + name/title/experience/about). */
function InstructorsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-6 overflow-hidden pb-8">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="shrink-0 w-[260px]">
          <div className="bg-white rounded-3xl overflow-hidden shadow-lg">
            {/* Photo region */}
            <Skeleton className="h-[230px] w-full rounded-none" />
            {/* Content */}
            <div className="p-5">
              {/* Name */}
              <Skeleton className="h-7 w-3/4 mb-2" />
              {/* Dot + title */}
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="w-1 h-1 rounded-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              {/* Experience */}
              <Skeleton className="h-4 w-2/5 mb-6" />
              {/* About paragraph */}
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Instructors() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  // Parallax: use a ref + direct DOM mutation + rAF instead of setState-per-pixel,
  // which was re-rendering the entire instructor list on every scroll tick.
  const parallaxRef = useRef<HTMLDivElement | null>(null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch instructors from database
  useEffect(() => {
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/instructors");
      const data = res.ok ? await res.json() : [];
      const unique = dedupeInstructorRows(
        data as { id: string; name: string; display_order?: number | null; about?: string | null; image_url?: string | null; specialties?: string[] }[],
      );
      const transformedInstructors: Instructor[] = unique.map((instructor: {
        id?: string; name: string; title?: string; years_of_experience?: number; about?: string;
        image_url?: string; specialties?: string[]; certifications?: string[];
        philosophy?: string; social_facebook?: string; social_twitter?: string;
        social_linkedin?: string; social_whatsapp?: string;
      }) => ({
        id: instructor.id,
        name: instructor.name,
        title: instructor.title || "Instructor",
        experience: instructor.years_of_experience ? `${instructor.years_of_experience} years experience` : "",
        about: instructor.about || "",
        image: instructor.image_url || cdnUrl("/placeholder.jpg"),
        image_url: instructor.image_url,
        specialties: instructor.specialties || [],
        certifications: instructor.certifications || [],
        philosophy: instructor.philosophy || "",
        social_facebook: instructor.social_facebook,
        social_twitter: instructor.social_twitter,
        social_linkedin: instructor.social_linkedin,
        social_whatsapp: instructor.social_whatsapp,
      }));
      setInstructors(transformedInstructors);
    } catch (error) {
      console.error("Error fetching instructors:", error);
      setInstructors([]);
    } finally {
      setLoading(false);
    }
  };

  // Parallax scroll — rAF-throttled, mutates DOM via ref (no React re-render per pixel).
  useEffect(() => {
    let ticking = false;
    const update = () => {
      if (parallaxRef.current) {
        parallaxRef.current.style.transform = `translateY(${window.scrollY * 0.3}px)`;
      }
      ticking = false;
    };
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle smooth scroll with momentum
  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current && !isScrolling) {
      setIsScrolling(true);
      const scrollAmount = 320;
      const currentScroll = scrollContainerRef.current.scrollLeft;
      const targetScroll = currentScroll + (direction === "right" ? scrollAmount : -scrollAmount);
      
      const startTime = performance.now();
      const duration = 600;
      
      const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentPosition = currentScroll + (targetScroll - currentScroll) * easeOutCubic;
        
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = currentPosition;
        }
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        } else {
          setIsScrolling(false);
        }
      };
      
      requestAnimationFrame(animateScroll);
    }
  };

  const handleImageLoad = (index: number) => {
    setLoadedImages(prev => new Set([...prev, index]));
  };

  const handleImageError = (index: number) => {
    console.error(`Failed to load image for instructor at index ${index}`);
    // Still mark as "loaded" to hide skeleton
    setLoadedImages(prev => new Set([...prev, index]));
  };

  const openModal = (instructor: Instructor) => {
    setSelectedInstructor(instructor);
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    setSelectedInstructor(null);
    document.body.style.overflow = "unset";
  };

  // Restore body scroll on unmount in case user navigates away while modal is open.
  useEffect(() => {
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <section id="instructors" className="py-16 md:py-20 bg-linear-to-b from-cream via-white to-cream relative overflow-hidden">
      {/* Parallax Background Texture - Enhanced */}
      <div
        ref={parallaxRef}
        className="absolute inset-0 opacity-[0.04] transition-transform duration-100 ease-out will-change-transform"
      >
        <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-linear-to-br from-sage to-terracotta blur-3xl animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute bottom-20 right-20 w-[500px] h-[500px] rounded-full bg-linear-to-tl from-sage via-terracotta/30 to-sage blur-3xl animate-pulse" style={{ animationDuration: "12s", animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-radial from-sage/10 to-transparent blur-2xl" />
      </div>

      {/* Subtle Gold Accent Lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-terracotta/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-terracotta/20 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section Header - Enhanced */}
        <div className="text-center mb-20">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-px bg-linear-to-r from-transparent to-sage/50" />
            <div className="w-2 h-2 rounded-full bg-terracotta/60" />
            <div className="w-12 h-px bg-linear-to-l from-transparent to-sage/50" />
          </div>

          <h2 className="font-display text-4xl md:text-5xl text-charcoal mb-6 tracking-tight">
            Meet Your Instructors
          </h2>
          
          <p className="font-body text-lg md:text-xl text-charcoal/70 max-w-3xl mx-auto leading-relaxed">
            Trained experts who bring passion, precision, and heart to every class. 
            Each instructor is deeply committed to your transformation journey.
          </p>

          <div className="flex items-center justify-center gap-3 mt-8">
            <div className="w-16 h-px bg-linear-to-r from-transparent via-sage/30 to-sage/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-sage/40" />
            <div className="w-8 h-px bg-sage/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-terracotta/40" />
            <div className="w-16 h-px bg-linear-to-l from-transparent via-sage/30 to-sage/50" />
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="w-full py-4">
            <InstructorsSkeleton count={3} />
          </div>
        ) : instructors.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-body text-charcoal/60">No instructors found.</p>
          </div>
        ) : (
          <>
            {/* Carousel Container - Enhanced */}
            <div className="relative group">
              <Button
                type="button"
                variant="sage-outline"
                size="icon-lg"
                onClick={() => scroll("left")}
                disabled={isScrolling}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 rounded-full bg-white/80 backdrop-blur-xl border border-sage/20 opacity-0 group-hover:opacity-100"
                aria-label="Scroll left"
              >
                <ChevronLeft className="text-sage" size={28} strokeWidth={2} />
              </Button>

              <Button
                type="button"
                variant="sage-outline"
                size="icon-lg"
                onClick={() => scroll("right")}
                disabled={isScrolling}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 rounded-full bg-white/80 backdrop-blur-xl border border-sage/20 opacity-0 group-hover:opacity-100"
                aria-label="Scroll right"
              >
                <ChevronRight className="text-sage" size={28} strokeWidth={2} />
              </Button>

              {/* Scrollable Carousel */}
              <div
                ref={scrollContainerRef}
                className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-8 snap-x snap-mandatory"
                style={{ 
                  scrollbarWidth: "none", 
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch"
                }}
              >
                {instructors.map((instructor, index) => (
                  <div
                    key={instructor.id ?? `${instructor.name}-${index}`}
                    className="shrink-0 w-[260px] group/card snap-center cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => openModal(instructor)}
                  >
                    <div
                      className={`bg-white rounded-3xl overflow-hidden transition-all duration-700 ease-out will-change-transform ${
                        hoveredIndex === index
                          ? "scale-105 shadow-2xl ring-2 ring-sage/20"
                          : "scale-100 shadow-lg hover:shadow-xl"
                      }`}
                      style={{
                        transform: hoveredIndex === index ? "translateY(-8px) scale(1.05)" : "translateY(0) scale(1)"
                      }}
                    >
                      <div className="relative h-[230px] overflow-hidden bg-linear-to-b from-sage/5 to-cream/30">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-transparent via-terracotta/30 to-transparent z-10" />
                        
                        {/* Skeleton Loading State */}
                        {!loadedImages.has(index) && (
                          <div className="absolute inset-0 bg-linear-to-br from-sage/10 via-cream/50 to-sage/10 animate-pulse" />
                        )}
                        
                        {/* Instructor Photo */}
                        <InstructorCarouselPhoto
                          src={instructor.image}
                          name={instructor.name}
                          index={index}
                          onLoad={() => handleImageLoad(index)}
                          onError={() => handleImageError(index)}
                        />
                        
                        {/* Hover Overlay */}
                        <div 
                          className={`absolute inset-0 bg-linear-to-t from-sage/10 to-transparent transition-opacity duration-700 ${
                            hoveredIndex === index ? "opacity-100" : "opacity-0"
                          }`}
                        />

                        {/* Decorative Corners */}
                        <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-terracotta/20 rounded-tl-lg" />
                        <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-terracotta/20 rounded-tr-lg" />
                      </div>

                      <div className="p-5 bg-linear-to-b from-white to-cream/30">
                        <h3 className="font-display font-normal text-2xl text-charcoal mb-2 tracking-tight leading-tight">
                          {instructor.name}
                        </h3>

                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1 h-1 rounded-full bg-terracotta/60" />
                          <p className="font-body text-sage font-semibold text-sm uppercase tracking-wider">
                            {instructor.title}
                          </p>
                        </div>

                        <p className="font-body text-charcoal/60 text-sm mb-6 italic">
                          {instructor.experience}
                        </p>

                        <div
                          className={`font-body text-sm text-charcoal/80 leading-relaxed transition-all duration-700 ease-in-out overflow-hidden ${
                            hoveredIndex === index
                              ? "max-h-[400px] opacity-100"
                              : "max-h-20 opacity-70"
                          }`}
                          style={{
                            willChange: "max-height, opacity"
                          }}
                        >
                          {instructor.about}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          <div className="text-center mt-12">
            <p className="font-body text-charcoal/40 text-sm tracking-wide">
              Click a card to learn more • Scroll to discover all instructors
            </p>
            
            <div className="flex items-center justify-center gap-2 mt-6">
              <div className="w-12 h-px bg-linear-to-r from-transparent to-sage/20" />
              <div className="w-1 h-1 rounded-full bg-sage/30" />
              <div className="w-12 h-px bg-linear-to-l from-transparent to-sage/20" />
            </div>
          </div>
        </>
        )}
      </div>

      {/* Schedule Button Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 mt-16">
        <div className="text-center">
          <Link href="/classes?tab=schedule">
            <Button variant="sage" size="lg" className="rounded-full">
              View Weekly Schedule
            </Button>
          </Link>
          <p className="font-body text-charcoal/50 text-sm mt-4">
            Check our full weekly class schedule
          </p>
        </div>
      </div>

      {/* Full-Screen Modal */}
      {selectedInstructor && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-md animate-in fade-in duration-300"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative h-56 bg-linear-to-br from-sage/10 via-cream to-terracotta/10">
              <CloseButton
                onClick={closeModal}
                label="Close modal"
                className="absolute top-4 right-4 rounded-full bg-white/80 backdrop-blur-xl border border-sage/20 z-10"
              />

              <div className="absolute inset-0 flex items-end justify-center pb-6">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl">
                  <InstructorModalPhoto src={selectedInstructor.image} name={selectedInstructor.name} />
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 md:p-8">
              {/* Name & Title */}
              <div className="text-center mb-6">
                <h2 className="font-display font-normal text-3xl md:text-4xl text-charcoal mb-2">
                  {selectedInstructor.name}
                </h2>
                <p className="font-body text-sage font-semibold text-base uppercase tracking-wider">
                  {selectedInstructor.title}
                </p>
                <p className="font-body text-charcoal/60 italic mt-1 text-sm">
                  {selectedInstructor.experience}
                </p>
              </div>

              {/* Social Media Links */}
              {(selectedInstructor.social_facebook || selectedInstructor.social_twitter || selectedInstructor.social_linkedin || selectedInstructor.social_whatsapp) && (
                <div className="mb-6 flex items-center justify-center gap-2">
                  <span className="font-body text-xs text-charcoal/60 mr-1">Connect:</span>
                  
                  {selectedInstructor.social_facebook && (
                    <a
                      href={selectedInstructor.social_facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-[#1877F2]/10 hover:bg-[#1877F2]/20 flex items-center justify-center transition-all duration-200 hover:scale-110"
                      aria-label="Facebook Profile"
                    >
                      <Facebook className="text-[#1877F2]" size={16} />
                    </a>
                  )}
                  
                  {selectedInstructor.social_twitter && (
                    <a
                      href={selectedInstructor.social_twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 flex items-center justify-center transition-all duration-200 hover:scale-110"
                      aria-label="Twitter Profile"
                    >
                      <Twitter className="text-[#1DA1F2]" size={16} />
                    </a>
                  )}
                  
                  {selectedInstructor.social_linkedin && (
                    <a
                      href={selectedInstructor.social_linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 flex items-center justify-center transition-all duration-200 hover:scale-110"
                      aria-label="LinkedIn Profile"
                    >
                      <Linkedin className="text-[#0A66C2]" size={16} />
                    </a>
                  )}
                  
                  {selectedInstructor.social_whatsapp && (
                    <a
                      href={`https://wa.me/${selectedInstructor.social_whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/20 flex items-center justify-center transition-all duration-200 hover:scale-110"
                      aria-label="WhatsApp"
                    >
                      <MessageCircle className="text-[#25D366]" size={16} />
                    </a>
                  )}
                </div>
              )}

              {/* Philosophy */}
              <div className="mb-6 p-4 bg-sage/5 rounded-xl border-l-4 border-sage">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="text-sage" size={18} />
                  <h3 className="font-display text-lg font-semibold text-charcoal">Philosophy</h3>
                </div>
                <p className="font-body text-charcoal/80 leading-relaxed italic text-sm">
                  "{selectedInstructor.philosophy}"
                </p>
              </div>

              {/* About */}
              <div className="mb-6">
                <h3 className="font-display text-xl font-semibold text-charcoal mb-3">About</h3>
                <p className="font-body text-charcoal/80 leading-relaxed text-sm">
                  {selectedInstructor.about}
                </p>
              </div>

              {/* Specialties */}
              <div className="mb-6">
                <h3 className="font-display text-xl font-semibold text-charcoal mb-3">Specialties</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedInstructor.specialties.map((specialty) => (
                    <span
                      key={specialty}
                      className="px-3 py-1.5 bg-sage/10 text-sage font-body font-medium rounded-full border border-sage/20 text-sm"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>

              {/* Certifications */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Award className="text-terracotta" size={20} />
                  <h3 className="font-display text-xl font-semibold text-charcoal">Certifications</h3>
                </div>
                <ul className="space-y-2">
                  {selectedInstructor.certifications.map((cert) => (
                    <li key={cert} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-terracotta/60 mt-1.5 shrink-0" />
                      <span className="font-body text-charcoal/80 text-sm">{cert}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Close Button */}
              <div className="mt-8 text-center">
                <Button
                  type="button"
                  variant="sage"
                  onClick={closeModal}
                  className="rounded-full"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .snap-x {
          scroll-snap-type: x proximity;
        }
        
        .snap-center {
          scroll-snap-align: center;
        }
        
        .will-change-transform {
          will-change: transform;
        }
      `}</style>
    </section>
  );
}