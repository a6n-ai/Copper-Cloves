import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X, LogIn, Ticket, LayoutDashboard, LogOut, ChevronDown } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  const { data: session, status } = useSession();
  const authed = status === "authenticated";
  const role = (session?.user as { role?: string } | undefined)?.role;
  const dashHref =
    role === "admin" ? "/admin/dashboard"
    : role === "partner" ? "/partner/dashboard"
    : role === "instructor" ? "/instructor/dashboard"
    : "/portal/dashboard";
  const accountName = session?.user?.name || session?.user?.email || "Account";
  const accountInitial = accountName.slice(0, 1).toUpperCase();

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
        ? "bg-[#fafaf8]/90 backdrop-blur-md border-b border-charcoal/10 shadow-xs"
        : "bg-transparent border-b border-transparent shadow-none",
    ],
    !isOverlay && [
      "sticky top-0 z-50 border-b",
      scrolled
        ? "bg-[#fafaf8]/92 backdrop-blur-md border-charcoal/10 shadow-xs"
        : "bg-[#fafaf8]/85 backdrop-blur-xl border-sage/10",
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
              className={cn(
                "h-12 w-auto max-w-[min(85vw,300px)] object-contain object-left transition-[filter] duration-300 md:h-14",
                // Black lockup: keep dark on the light/blurred bar, invert to
                // light (with a soft shadow) when the bar is transparent over the hero.
                isOverlay && !scrolled
                  ? "brightness-0 invert drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)]"
                  : "brightness-0",
              )}
              priority={isOverlay}
            />
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-8 lg:gap-10">
            <Link href="/classes" className={linkClass}>
              Classes
            </Link>
            <Link href="/instructors" className={linkClass}>
              Instructors
            </Link>
            <Link href="/pricing" className={linkClass}>
              Pricing
            </Link>
            <Link href="/cafe" className={linkClass}>
              Café
            </Link>
            <Link href="/rental" className={linkClass}>
              Events
            </Link>
            <Link href="/story" className={linkClass}>
              Story
            </Link>
            {authed ? (
              <div className="flex items-center gap-3">
                <Link href="/portal/book">
                  <Button
                    className={cn(
                      "h-auto gap-2 rounded-full border-0 px-6 py-2.5 text-[15px] font-body font-medium text-cream shadow-xs",
                      HEADER_SAGE,
                    )}
                  >
                    <Ticket size={17} /> Book
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Account menu"
                      className="flex items-center gap-1.5 rounded-full border border-charcoal/15 bg-[#fafaf8]/80 py-1 pl-1 pr-2.5 transition-colors hover:bg-[#fafaf8] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#7A8B7C]/40"
                    >
                      <span className="flex size-7 items-center justify-center rounded-full bg-[#7A8B7C] font-display text-sm text-cream">
                        {accountInitial}
                      </span>
                      <ChevronDown size={15} className="text-charcoal/60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel className="truncate font-body">{accountName}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={dashHref} className="cursor-pointer">
                        <LayoutDashboard size={16} className="mr-2" /> Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="cursor-pointer text-terracotta focus:text-terracotta"
                    >
                      <LogOut size={16} className="mr-2" /> Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button
                    variant="ghost"
                    className="h-auto gap-2 rounded-full px-5 py-2.5 text-[15px] font-body font-medium text-charcoal hover:text-[#7A8B7C]"
                  >
                    <LogIn size={17} /> Login
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    className={cn(
                      "h-auto gap-2 rounded-full border-0 px-6 py-2.5 text-[15px] font-body font-medium text-cream shadow-xs",
                      HEADER_SAGE,
                    )}
                  >
                    <Ticket size={17} /> Book Now
                  </Button>
                </Link>
              </div>
            )}
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
              isOverlay ? "bg-[#fafaf8]/96 backdrop-blur-lg" : "bg-[#fafaf8]/95"
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
              href="/instructors"
              className="block font-body font-medium text-charcoal py-3 px-1 hover:text-[#7A8B7C]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Instructors
            </Link>
            <Link
              href="/pricing"
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
            <Link
              href="/rental"
              className="block font-body font-medium text-charcoal py-3 px-1 hover:text-[#7A8B7C]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Events
            </Link>
            <Link
              href="/story"
              className="block font-body font-medium text-charcoal py-3 px-1 hover:text-[#7A8B7C]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Story
            </Link>
            {authed ? (
              <div className="space-y-1 pt-2">
                <Link href="/portal/book" onClick={() => setMobileMenuOpen(false)} className="block">
                  <Button className={cn("h-auto w-full gap-2 rounded-full border-0 py-3 font-body font-medium text-cream", HEADER_SAGE)}>
                    <Ticket size={18} /> Book
                  </Button>
                </Link>
                <Link
                  href={dashHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-1 py-3 font-body font-medium text-charcoal hover:text-[#7A8B7C]"
                >
                  <LayoutDashboard size={18} /> Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); signOut({ callbackUrl: "/" }); }}
                  className="flex w-full items-center gap-2 px-1 py-3 font-body font-medium text-terracotta"
                >
                  <LogOut size={18} /> Log out
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block">
                  <Button variant="outline" className="h-auto w-full gap-2 rounded-full border-sage/40 py-3 font-body font-medium text-sage">
                    <LogIn size={18} /> Login
                  </Button>
                </Link>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block">
                  <Button className={cn("h-auto w-full gap-2 rounded-full border-0 py-3 font-body font-medium text-cream", HEADER_SAGE)}>
                    <Ticket size={18} /> Book Now
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
