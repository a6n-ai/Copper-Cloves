import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

/** Muted sage for CTA (reference ~#7A8B7C) */
const HEADER_SAGE = "bg-[#7A8B7C] hover:bg-[#6d7c6e] active:bg-[#637069]";

export type NavigationVariant = "default" | "overlay";

interface NavigationProps {
  /** `overlay`: fixed on top of full-bleed hero (transparent until scroll). */
  variant?: NavigationVariant;
}

export function Navigation({ variant = "default" }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isOverlay = variant === "overlay";

  const shellClass = cn(
    "w-full transition-all duration-300 ease-out",
    isOverlay && [
      "fixed top-0 left-0 right-0 z-50",
      scrolled
        ? "bg-white/90 backdrop-blur-md border-b border-charcoal/10 shadow-sm"
        : "bg-transparent border-b border-transparent shadow-none",
    ],
    !isOverlay && [
      "sticky top-0 z-50 border-b",
      scrolled
        ? "bg-white/92 backdrop-blur-md border-charcoal/10 shadow-sm"
        : "bg-white/78 backdrop-blur-xl border-sage/10",
    ]
  );

  const linkClass =
    "font-body text-[15px] font-medium text-charcoal hover:text-[#7A8B7C] transition-colors tracking-wide";

  return (
    <nav className={shellClass}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        <div className="flex justify-between items-center min-h-[4.25rem] md:min-h-[4.5rem] py-3">
          {/* Full lockup: THE STUDIO + byline (see /public/the_studio_by_C_C_og.png) */}
          <Link
            href="/"
            className="block select-none outline-none focus-visible:ring-2 focus-visible:ring-[#7A8B7C]/40 focus-visible:rounded-sm"
          >
            <Image
              src="/the_studio_by_C_C_og.png"
              alt="The STUDIO"
              width={320}
              height={84}
              className="h-10 w-auto max-w-[min(85vw,260px)] object-contain object-left brightness-0 transition-[filter] duration-300"
              priority={isOverlay}
            />
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-8 lg:gap-10">
            <Link href="/classes" className={linkClass}>
              Classes
            </Link>
            <Link href="/#instructors" className={linkClass}>
              Instructors
            </Link>
            <Link href="/#pricing" className={linkClass}>
              Pricing
            </Link>
            <Link href="/cafe" className={linkClass}>
              Café
            </Link>
            <Link href="/portal/login">
              <Button
                className={cn(
                  "rounded-full border-0 px-7 py-2.5 h-auto text-[15px] font-body font-medium text-white shadow-sm",
                  HEADER_SAGE
                )}
              >
                Book Now
              </Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2.5 rounded-full hover:bg-black/5 transition-colors"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? (
              <X size={22} className="text-charcoal" />
            ) : (
              <Menu size={22} className="text-charcoal" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div
            className={cn(
              "md:hidden pb-5 pt-1 space-y-1 rounded-b-2xl border-t border-charcoal/5 mt-1",
              isOverlay ? "bg-white/96 backdrop-blur-lg" : "bg-white/95"
            )}
          >
            <Link
              href="/classes"
              className="block font-body font-medium text-charcoal py-3 px-1 hover:text-[#7A8B7C]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Classes
            </Link>
            <Link
              href="/#instructors"
              className="block font-body font-medium text-charcoal py-3 px-1 hover:text-[#7A8B7C]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Instructors
            </Link>
            <Link
              href="/#pricing"
              className="block font-body font-medium text-charcoal py-3 px-1 hover:text-[#7A8B7C]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              href="/cafe"
              className="block font-body font-medium text-charcoal py-3 px-1 hover:text-[#7A8B7C]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Café
            </Link>
            <Link href="/portal/login" onClick={() => setMobileMenuOpen(false)} className="block pt-2">
              <Button
                className={cn(
                  "w-full rounded-full border-0 py-3 h-auto font-body font-medium text-white",
                  HEADER_SAGE
                )}
              >
                Book Now
              </Button>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
