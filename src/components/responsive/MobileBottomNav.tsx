import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { QrCode, Menu, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScanCheckInModal } from "@/components/checkin/ScanCheckInModal";
import { flattenNavItems, type NavLink, type PortalConfig } from "@/components/dashboard/dashboardNav";

/**
 * App-style mobile bottom navigation, driven by the portal's `dashboardNav`
 * config so it never drifts from the desktop sidebar. Phones only (`md:hidden`).
 *
 * - Shows `config.mobilePrimary` as side tabs; everything else lives under "More".
 * - `config.mobileScanner` adds a raised center Check-in Scanner FAB
 *   (member + instructor) that opens the shared ScanCheckInModal.
 */
export function MobileBottomNav({ config }: { config: PortalConfig }) {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const all = flattenNavItems(config);
  const byHref = new Map(all.map((i) => [i.href, i]));
  const primary = config.mobilePrimary
    .map((href) => byHref.get(href))
    .filter((i): i is NavLink => Boolean(i));
  const primaryHrefs = new Set(primary.map((i) => i.href));
  const overflow = all.filter((i) => !primaryHrefs.has(i.href));
  const showMore = overflow.length > 0;
  const showScanner = Boolean(config.mobileScanner);

  if (all.length <= 1 && !showScanner) return null;

  const isActive = (href: string) => router.pathname === href;
  const moreActive = overflow.some((i) => isActive(i.href));

  type Slot =
    | { type: "link"; href: string; label: string; icon: LucideIcon }
    | { type: "more" };
  const slots: Slot[] = [
    ...primary.map((i) => ({ type: "link" as const, href: i.href, label: i.label, icon: i.icon })),
    ...(showMore ? [{ type: "more" as const }] : []),
  ];

  const renderSlot = (slot: Slot, key: string) => {
    const cls = (active: boolean) =>
      cn(
        "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-body transition-colors",
        active ? "text-terracotta" : "text-charcoal/55 hover:text-charcoal",
      );
    if (slot.type === "more") {
      return (
        <button key={key} type="button" onClick={() => setMoreOpen(true)} className={cls(moreActive)}>
          <Menu className="h-5 w-5" />
          More
        </button>
      );
    }
    const Icon = slot.icon;
    return (
      <Link key={key} href={slot.href} className={cls(isActive(slot.href))}>
        <Icon className="h-5 w-5" />
        <span className="max-w-full truncate px-0.5">{shortLabel(slot.label)}</span>
      </Link>
    );
  };

  const mid = Math.ceil(slots.length / 2);
  const left = slots.slice(0, mid);
  const right = slots.slice(mid);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-sage/15 bg-white/90 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {showScanner ? (
          <div className="flex items-stretch">
            <div className="flex flex-1 items-stretch">{left.map((s, i) => renderSlot(s, `l${i}`))}</div>
            <div className="relative flex w-20 shrink-0 justify-center">
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                aria-label="Scan to check in"
                className="absolute -top-5 flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full border-4 border-white bg-terracotta text-white shadow-lg shadow-terracotta/30 transition-transform active:scale-95"
              >
                <QrCode className="h-6 w-6" />
                <span className="text-[9px] font-body leading-none">Check in</span>
              </button>
            </div>
            <div className="flex flex-1 items-stretch">{right.map((s, i) => renderSlot(s, `r${i}`))}</div>
          </div>
        ) : (
          <div className="flex items-stretch">{slots.map((s, i) => renderSlot(s, `s${i}`))}</div>
        )}
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="font-display text-charcoal">Menu</SheetTitle>
          </SheetHeader>
          <div className="mt-2 space-y-5 pb-[env(safe-area-inset-bottom)]">
            {config.sections.map((section) => (
              <div key={section.label}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-charcoal/40">{section.label}</p>
                <div className="grid grid-cols-1 gap-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "flex min-h-12 items-center gap-3 rounded-xl px-3 font-body text-sm transition-colors",
                          isActive(item.href) ? "bg-terracotta/10 text-terracotta" : "text-charcoal hover:bg-sage/5",
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {showScanner ? <ScanCheckInModal open={scanOpen} onOpenChange={setScanOpen} /> : null}
    </>
  );
}

/** Keep bottom-tab labels short ("Book Class" → "Book", "My Bookings" → "Bookings"). */
function shortLabel(label: string): string {
  return label
    .replace(/^Book Class$/i, "Book")
    .replace(/^My Bookings$/i, "Bookings")
    .replace(/^Café Menu$/i, "Café");
}
