import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import {
  Home,
  CalendarDays,
  Tag,
  Menu,
  Ticket,
  Coffee,
  Users,
  Sparkles,
  BookOpen,
  Shield,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Tab = { href: string; label: string; icon: LucideIcon };

const TABS_LEFT: Tab[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/classes", label: "Classes", icon: CalendarDays },
];
const TABS_RIGHT: Tab[] = [{ href: "/pricing", label: "Pricing", icon: Tag }];
const MORE_LINKS: Tab[] = [
  { href: "/cafe", label: "Café", icon: Coffee },
  { href: "/instructors", label: "Instructors", icon: Users },
  { href: "/rental", label: "Events", icon: Sparkles },
  { href: "/story", label: "Story", icon: BookOpen },
];
const MORE_LEGAL: Tab[] = [
  { href: "/policy", label: "Policy", icon: Shield },
  { href: "/terms", label: "Terms", icon: FileText },
];

/**
 * App-style bottom tab bar for the public marketing site (`md:hidden`), built
 * to mirror the dashboard's MobileBottomNav: side tabs flanking a raised center
 * "Book" FAB (the public analogue of the dashboard check-in FAB), plus a "More"
 * bottom sheet for overflow. Reveal-on-scroll: hidden over the hero, slides up
 * past ~60% of the first viewport. Mounted once in PublicChrome (_app.tsx).
 */
export function PublicMobileNav() {
  const router = useRouter();
  const { status } = useSession();
  const bookHref = status === "authenticated" ? "/portal/book" : "/portal/signup";
  const [show, setShow] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // rAF-throttled, compare-and-skip (same pattern as Navigation.tsx).
  useEffect(() => {
    let ticking = false;
    let last = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const next = window.scrollY > window.innerHeight * 0.6;
        if (next !== last) {
          last = next;
          setShow(next);
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the More sheet on navigation.
  useEffect(() => {
    const close = () => setMoreOpen(false);
    router.events.on("routeChangeComplete", close);
    return () => router.events.off("routeChangeComplete", close);
  }, [router.events]);

  const isActive = (href: string) =>
    href === "/"
      ? router.pathname === "/"
      : router.pathname === href || router.pathname.startsWith(`${href}/`);
  const moreActive = [...MORE_LINKS, ...MORE_LEGAL].some((l) => isActive(l.href));

  const tabCls = (active: boolean) =>
    cn(
      "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-body transition-colors",
      active ? "text-terracotta" : "text-charcoal/55 hover:text-charcoal",
    );

  const renderTab = (tab: Tab) => {
    const Icon = tab.icon;
    return (
      <Link key={tab.href} href={tab.href} tabIndex={show ? 0 : -1} className={tabCls(isActive(tab.href))}>
        <Icon className="h-5 w-5" />
        <span className="max-w-full truncate px-0.5">{tab.label}</span>
      </Link>
    );
  };

  const renderMoreRow = (l: Tab, muted = false) => {
    const Icon = l.icon;
    let inactiveClass: string;
    if (muted) {
      inactiveClass = "text-charcoal/70 hover:bg-sage/5";
    } else {
      inactiveClass = "text-charcoal hover:bg-sage/5";
    }
    return (
      <Link
        key={l.href}
        href={l.href}
        onClick={() => setMoreOpen(false)}
        className={cn(
          "flex min-h-12 items-center gap-3 rounded-xl px-3 font-body text-sm transition-colors",
          isActive(l.href) ? "bg-terracotta/10 text-terracotta" : inactiveClass,
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {l.label}
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-hidden={!show}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-sage/15 bg-white-warm md:hidden",
          "transition-transform duration-300 ease-out motion-reduce:transition-none",
          show ? "translate-y-0" : "pointer-events-none translate-y-[150%]",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch">
          <div className="flex flex-1 items-stretch">{TABS_LEFT.map(renderTab)}</div>

          <div className="relative flex w-20 shrink-0 justify-center">
            <Link
              href={bookHref}
              tabIndex={show ? 0 : -1}
              aria-label="Book a class"
              className="absolute -top-5 flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full border-4 border-cream bg-terracotta text-cream shadow-lg shadow-terracotta/30 transition-transform active:scale-95 motion-reduce:transition-none"
            >
              <Ticket className="h-6 w-6" />
              <span className="text-[9px] font-body leading-none">Book</span>
            </Link>
          </div>

          <div className="flex flex-1 items-stretch">
            {TABS_RIGHT.map(renderTab)}
            <button type="button" onClick={() => setMoreOpen(true)} tabIndex={show ? 0 : -1} className={tabCls(moreActive)}>
              <Menu className="h-5 w-5" />
              More
            </button>
          </div>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-2xl md:hidden">
          <SheetHeader>
            <SheetTitle className="font-display text-charcoal">Explore</SheetTitle>
          </SheetHeader>
          <div className="mt-2 grid grid-cols-1 gap-1 pb-[env(safe-area-inset-bottom)]">
            {MORE_LINKS.map((l) => renderMoreRow(l))}
            <div className="my-1 h-px bg-sage/10" />
            {MORE_LEGAL.map((l) => renderMoreRow(l, true))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
