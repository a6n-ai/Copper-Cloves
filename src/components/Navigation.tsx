import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { LogIn, Ticket, LayoutDashboard, LogOut } from "lucide-react";
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

const NAV_LINKS = [
  { href: "/classes", label: "Classes" },
  { href: "/instructors", label: "Instructors" },
  { href: "/pricing", label: "Pricing" },
  { href: "/cafe", label: "Café" },
  { href: "/rental", label: "Events" },
  { href: "/story", label: "Story" },
] as const;

export type NavigationVariant = "default" | "overlay";

interface NavigationProps {
  /** `overlay`: fixed on top of full-bleed hero (transparent until scroll). */
  variant?: NavigationVariant;
}

/** Desktop nav link with a sage (or cream, over the hero) active/hover underline. */
function NavLink({ href, label, active, onHero }: Readonly<{ href: string; label: string; active: boolean; onHero: boolean }>) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative rounded-sm py-1 font-body text-[15px] font-medium tracking-wide transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2",
        onHero
          ? "text-cream/85 hover:text-cream focus-visible:ring-cream/50 focus-visible:ring-offset-transparent"
          : "text-charcoal hover:text-charcoal focus-visible:ring-sage/40 focus-visible:ring-offset-white-warm",
      )}
    >
      {label}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -bottom-0.5 left-0 h-0.5 rounded-full transition-[width] duration-300 ease-out",
          onHero ? "bg-cream" : "bg-sage",
          active ? "w-full" : "w-0 group-hover:w-full",
        )}
      />
    </Link>
  );
}

/** Per-role dashboard landing path; falls back to the shared member portal. */
const DASH_HREF_BY_ROLE: Record<string, string> = {
  admin: "/admin/dashboard",
  partner: "/partner/dashboard",
  instructor: "/instructor/dashboard",
};
function dashHrefForRole(role?: string) {
  return (role && DASH_HREF_BY_ROLE[role]) || "/portal/dashboard";
}

/** Nav shell classes: overlay (fixed over hero) vs default (sticky), each with a scrolled state. */
function navShellClass(isOverlay: boolean, scrolled: boolean) {
  return cn(
    "w-full transition-all duration-300 ease-out",
    isOverlay && [
      "fixed top-0 left-0 right-0 z-50",
      scrolled
        ? "bg-[#fafaf8]/90 backdrop-blur-md border-b border-charcoal/10 shadow-xs"
        // Solid on mobile (transparent reads as "no navbar"); transparent over the hero on md+.
        : "bg-[#fafaf8]/90 backdrop-blur-md border-b border-charcoal/10 shadow-xs md:border-transparent md:bg-transparent md:shadow-none md:backdrop-blur-none",
    ],
    !isOverlay && [
      "sticky top-0 z-50 border-b",
      scrolled
        ? "bg-[#fafaf8]/92 backdrop-blur-md border-charcoal/10 shadow-xs"
        : "bg-[#fafaf8]/85 backdrop-blur-xl border-sage/10",
    ],
  );
}

export function Navigation({ variant = "default" }: Readonly<NavigationProps>) {
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();
  const authed = status === "authenticated";
  const role = (session?.user as { role?: string } | undefined)?.role;
  const dashHref = dashHrefForRole(role);
  const accountName = session?.user?.name || session?.user?.email || "Account";
  const accountInitial = accountName.slice(0, 1).toUpperCase();

  const isActive = (href: string) =>
    router.pathname === href || router.pathname.startsWith(`${href}/`);

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

  const isOverlay = variant === "overlay";
  // "On hero": transparent overlay bar sitting over the dark hero — use light
  // ink so the logo, links and actions stay legible (DESIGN.md nav spec).
  const onHero = isOverlay && !scrolled;

  const shellClass = navShellClass(isOverlay, scrolled);

  return (
    <nav className={shellClass}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
        <div className="flex justify-between items-center min-h-17 md:min-h-18 py-3">
          {/* Full lockup: THE STUDIO + byline (see /public/the_studio_by_C_C_og.png) */}
          <Link
            href="/"
            aria-label="The Studio by Copper and Cloves — home"
            className="block select-none outline-hidden focus-visible:ring-2 focus-visible:ring-sage/40 focus-visible:rounded-sm"
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
                // Dark on the solid bar (incl. mobile overlay); white only over the
                // transparent hero on md+.
                onHero
                  ? "brightness-0 md:invert md:drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)]"
                  : "brightness-0",
              )}
              priority={isOverlay}
            />
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-7 lg:gap-9">
            {NAV_LINKS.map((l) => (
              <NavLink key={l.href} href={l.href} label={l.label} active={isActive(l.href)} onHero={onHero} />
            ))}

            <span className={cn("h-5 w-px", onHero ? "bg-cream/30" : "bg-charcoal/15")} aria-hidden="true" />

            {authed ? (
              <div className="flex items-center gap-3">
                <Button asChild variant="terracotta" size="lg">
                  <Link href="/portal/book">
                    <Ticket size={17} /> Book
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Account menu"
                      className="flex size-11 items-center justify-center rounded-full bg-sage font-display text-base text-cream shadow-xs transition-colors hover:bg-sage/90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sage/40"
                    >
                      {accountInitial}
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
                <Button asChild variant="terracotta" size="lg">
                  <Link href="/login">
                    <Ticket size={17} /> Book Now
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className={cn(
                    onHero
                      ? "text-cream hover:bg-cream/10 hover:text-cream"
                      : "text-charcoal hover:bg-charcoal/5 hover:text-charcoal",
                  )}
                >
                  <Link href="/login">
                    <LogIn size={17} /> Login
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile auth (top-right) — navigation lives in the bottom tab bar */}
          <div className="md:hidden">
            {authed ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="flex size-10 items-center justify-center rounded-full bg-sage font-display text-base text-cream shadow-xs focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sage/40"
                  >
                    {accountInitial}
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
                  <DropdownMenuItem asChild>
                    <Link href="/portal/book" className="cursor-pointer">
                      <Ticket size={16} className="mr-2" /> Book a class
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
            ) : (
              <Button asChild variant="terracotta">
                <Link href="/login">
                  <LogIn size={16} /> Login
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
