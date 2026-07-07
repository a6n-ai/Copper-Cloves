import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import { LogIn, Ticket, LayoutDashboard, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { cdnUrl } from "@/lib/cdnUrl";
import GlassSurface from "@/components/GlassSurface";

const NAV_LINKS = [
  { href: "/classes", label: "Classes" },
  { href: "/instructors", label: "Instructors" },
  { href: "/pricing", label: "Pricing" },
  { href: "/cafe", label: "Café" },
  { href: "/rental", label: "Events" },
  { href: "/story", label: "Story" },
] as const;

const DASH_HREF_BY_ROLE: Record<string, string> = {
  admin: "/admin/dashboard",
  partner: "/partner/dashboard",
  instructor: "/instructor/dashboard",
};
const dashHrefForRole = (role?: string) =>
  (role && DASH_HREF_BY_ROLE[role]) || "/portal/dashboard";

/**
 * Floating "liquid glass" nav bar for public pages (reactbits GlassSurface).
 * ponytail: text ink swaps light→charcoal on scroll — glass is legible over the
 * dark hero but not over cream content further down. Ink swap is the calibration knob.
 * NOTE: intentionally departs from design.md's no-decorative-glass rule (requested).
 */
export function GlassNavigation({ variant = "default" }: Readonly<{ variant?: "default" | "overlay" }>) {
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

  // rAF-throttled, flip-only (mirrors Navigation.tsx).
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

  // Light ink only over the dark hero (overlay pages, un-scrolled). Default
  // pages open on cream, so ink stays charcoal from the top.
  const light = variant === "overlay" && !scrolled;

  return (
    <div className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <GlassSurface
        width="100%"
        height={72}
        borderRadius={8}
        backgroundOpacity={0.18}
        blur={4}
        className="mx-auto max-w-7xl"
      >
        <div className="flex w-full items-center justify-between gap-4 px-5 sm:px-7">
          <Link
            href="/"
            aria-label="The Studio by Copper and Cloves — home"
            className="block select-none outline-hidden focus-visible:ring-2 focus-visible:ring-sage/50 focus-visible:rounded-sm"
          >
            <Image
              src={cdnUrl("/logo2.png")}
              alt="The STUDIO"
              width={314}
              height={182}
              priority
              className={cn(
                "h-12 w-auto object-contain object-left transition-[filter] duration-300 md:h-14",
                // logo2 is white-on-transparent: keep white over the hero (add a
                // soft shadow); invert to black on the solid/blurred bar.
                light
                  ? "drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)]"
                  : "brightness-0",
              )}
            />
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-6 md:flex lg:gap-8">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={cn(
                  "group relative rounded-sm py-1 font-body text-[15px] font-medium tracking-wide transition-colors focus:outline-hidden [text-shadow:0_1px_2px_rgba(0,0,0,0.15)]",
                  light ? "text-cream drop-shadow-sm" : "text-charcoal",
                )}
              >
                {l.label}
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute -bottom-0.5 left-0 h-0.5 rounded-full transition-[width] duration-300 ease-out",
                    light ? "bg-cream" : "bg-sage",
                    isActive(l.href) ? "w-full" : "w-0 group-hover:w-full",
                  )}
                />
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {authed ? (
              <>
                <Button asChild variant="terracotta" className="hidden sm:inline-flex">
                  <Link href="/portal/book">
                    <Ticket size={16} /> Book
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Account menu"
                      className="flex size-10 items-center justify-center rounded-full bg-sage font-display text-base text-cream shadow-xs transition-colors hover:bg-sage/90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sage/40"
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
              </>
            ) : (
              <Button asChild variant="terracotta">
                <Link href="/login">
                  <LogIn size={16} /> Login
                </Link>
              </Button>
            )}

            {/* Mobile links menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="md:hidden">
                <button
                  type="button"
                  aria-label="Open menu"
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full transition-colors focus:outline-hidden",
                    light ? "text-cream hover:bg-cream/10" : "text-charcoal hover:bg-charcoal/5",
                  )}
                >
                  <Menu size={20} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {NAV_LINKS.map((l) => (
                  <DropdownMenuItem key={l.href} asChild>
                    <Link href={l.href} className="cursor-pointer font-body">
                      {l.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </GlassSurface>
    </div>
  );
}
