import {
  LayoutDashboard,
  Calendar,
  CalendarCheck,
  Users,
  CreditCard,
  Award,
  MessageSquare,
  Coffee,
  Package,
  Settings,
  User,
  type LucideIcon,
} from "lucide-react";

export type PortalKind = "admin" | "partner" | "member" | "instructor";

export type NavLink = { href: string; label: string; icon: LucideIcon };
export type NavSection = { label: string; items: NavLink[] };

export interface PortalConfig {
  kind: PortalKind;
  /** Sidebar grouped navigation. */
  sections: NavSection[];
  /** Topbar pill label, e.g. "Admin Portal". */
  badgeLabel: string;
  /** Tailwind classes for the topbar pill. */
  badgeClass: string;
  /** Optional account-settings link shown in the profile dropdown. */
  accountHref?: string;
  accountLabel?: string;
  /** Subtitle under the user's name in footer / profile menu. */
  subtitle: string;
  /** Phone bottom-nav: hrefs shown as direct side tabs (rest fall under "More"). */
  mobilePrimary: string[];
  /** Phone bottom-nav: show the raised center check-in scanner FAB. */
  mobileScanner?: boolean;
}

/** All nav links across a portal's sections, flattened (sidebar order). */
export function flattenNavItems(config: PortalConfig): NavLink[] {
  return config.sections.flatMap((s) => s.items);
}

const SIGN_OUT_HREF = "/login";

export const PORTAL_CONFIGS: Record<PortalKind, PortalConfig> = {
  admin: {
    kind: "admin",
    badgeLabel: "Admin Portal",
    badgeClass: "bg-terracotta text-white",
    accountHref: "/admin/control",
    accountLabel: "Account Settings",
    subtitle: "Admin portal",
    mobilePrimary: ["/admin/dashboard", "/admin/schedule", "/admin/members", "/admin/CRM"],
    sections: [
      { label: "Dashboard", items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
      {
        label: "Operations",
        items: [
          { href: "/admin/schedule", label: "Schedule", icon: Calendar },
          { href: "/admin/members", label: "Members", icon: Users },
          { href: "/admin/credits", label: "Credits", icon: CreditCard },
          { href: "/admin/badges", label: "Badges", icon: Award },
          { href: "/admin/CRM", label: "CRM", icon: MessageSquare },
        ],
      },
      {
        label: "Catalog",
        items: [
          { href: "/admin/cafe", label: "Café Menu", icon: Coffee },
          { href: "/admin/products", label: "Products", icon: Package },
        ],
      },
      { label: "System", items: [{ href: "/admin/control", label: "Settings", icon: Settings }] },
    ],
  },
  partner: {
    kind: "partner",
    badgeLabel: "Partner Portal",
    badgeClass: "bg-sage text-white",
    accountHref: "/partner/settings",
    accountLabel: "Profile & settings",
    subtitle: "Partner portal",
    mobilePrimary: ["/partner/dashboard", "/partner/classes", "/partner/members", "/partner/settings"],
    sections: [
      { label: "Dashboard", items: [{ href: "/partner/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
      {
        label: "Operations",
        items: [
          { href: "/partner/classes", label: "Classes", icon: Calendar },
          { href: "/partner/members", label: "Members", icon: Users },
        ],
      },
      { label: "System", items: [{ href: "/partner/settings", label: "Settings", icon: Settings }] },
    ],
  },
  member: {
    kind: "member",
    badgeLabel: "Member Portal",
    badgeClass: "bg-sage text-white",
    accountHref: "/portal/profile",
    accountLabel: "Profile & settings",
    subtitle: "Member portal",
    mobilePrimary: ["/portal/dashboard", "/portal/book", "/portal/bookings"],
    mobileScanner: true,
    sections: [
      { label: "Dashboard", items: [{ href: "/portal/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
      {
        label: "Activity",
        items: [
          { href: "/portal/book", label: "Book Class", icon: Calendar },
          { href: "/portal/bookings", label: "My Bookings", icon: CalendarCheck },
          { href: "/portal/packages", label: "Packages", icon: Package },
          { href: "/portal/menu", label: "Café", icon: Coffee },
        ],
      },
      { label: "Account", items: [{ href: "/portal/profile", label: "Profile", icon: User }] },
    ],
  },
  instructor: {
    kind: "instructor",
    badgeLabel: "Instructor Portal",
    badgeClass: "bg-sage text-white",
    subtitle: "Instructor portal",
    mobilePrimary: ["/instructor/dashboard"],
    mobileScanner: true,
    sections: [
      { label: "Dashboard", items: [{ href: "/instructor/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    ],
  },
};

export { SIGN_OUT_HREF };
