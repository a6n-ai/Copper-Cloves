import Link from "next/link";
import { useRouter } from "next/router";
import { Home, CalendarPlus, Ticket, Coffee, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/portal/dashboard", label: "Home", icon: Home },
  { href: "/portal/book", label: "Book", icon: CalendarPlus },
  { href: "/portal/bookings", label: "Bookings", icon: Ticket },
  { href: "/portal/menu", label: "Café", icon: Coffee },
  { href: "/portal/profile", label: "Profile", icon: User },
];

export function MobileBottomNav() {
  const router = useRouter();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-sage/15 bg-white/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = router.pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-body transition-colors",
                  active ? "text-terracotta" : "text-charcoal/55 hover:text-charcoal",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
