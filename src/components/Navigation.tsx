import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";

import { cdnUrl } from "@/lib/cdnUrl";
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
  const router = useRouter();

  // rAF-throttled + compare-and-skip — only calls setState when the boolean
  // actually flips, so scrolling past the 24px threshold doesn't trigger a
  // setState per scroll tick. Fires at most once per animation frame.
  useEffect(() => {
    let ticking = false;
    let last = window.scrollY > 24;
    setScrolled(last);
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const next = window.scrollY > 24;
        if (next !== last) {
          last = next;
          setScrolled(next);
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const close = () => setMobileMenuOpen(false);
    router.events.on("routeChangeComplete", close);
    return () => router.events.off("routeChangeComplete", close);
  }, [router.events]);

  const isOverlay = variant === "overlay";

  const shellClass = cn(
    "w-full transition-all duration-300 ease-out",
    isOverlay && [
      "fixed top-0 left-0 right-0 z-50",
      scrolled
        ? "bg-white/90 backdrop-blur-md border-b border-charcoal/10 shadow-xs"
        : "bg-transparent border-b border-transparent shadow-none",
    ],
    !isOverlay && [
      "sticky top-0 z-50 border-b",
      scrolled
        ? "bg-white/92 backdrop-blur-md border-charcoal/10 shadow-xs"
        : "bg-white/78 backdrop-blur-xl border-sage/10",
    ]
  );

  const linkClass =
    "font-body text-[15px] font-medium text-charcoal hover:text-[#7A8B7C] transition-colors tracking-wide";

  return (
    <nav className={shellClass}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        <div className="flex justify-between items-center min-h-17 md:min-h-18 py-3">
          {/* Full lockup: THE STUDIO + byline (see /public/the_studio_by_C_C_og.png) */}
          <Link
            href="/"
            className="block select-none outline-hidden focus-visible:ring-2 focus-visible:ring-[#7A8B7C]/40 focus-visible:rounded-sm"
          >
            <Image
              src={cdnUrl("/the_studio_by_C_C_og.png")}
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
                  "rounded-full border-0 px-7 py-2.5 h-auto text-[15px] font-body font-medium text-white shadow-xs",
                  HEADER_SAGE
                )}
              >
                Book Now
              </Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-full"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? (
              <X size={22} className="text-charcoal" />
            ) : (
              <Menu size={22} className="text-charcoal" />
            )}
          </Button>
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
