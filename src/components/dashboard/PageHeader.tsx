import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface Crumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Override the auto-derived breadcrumb (e.g. to add a dynamic page name). */
  crumbs?: Crumb[];
}

/** Pretty labels for known route segments across every portal. */
const LABEL_MAP: Record<string, string> = {
  // shared
  dashboard: "Dashboard",
  // admin
  admin: "Admin",
  schedule: "Schedule",
  members: "Members",
  credits: "Credits",
  badges: "Badges",
  cafe: "Café Menu",
  products: "Products",
  control: "Settings",
  CRM: "CRM",
  // partner / instructor
  partner: "Partner",
  instructor: "Instructor",
  classes: "Classes",
  settings: "Settings",
  // member
  portal: "Home",
  book: "Book Class",
  bookings: "My Bookings",
  packages: "Packages",
  profile: "Profile",
  menu: "Café",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Boxed page heading with breadcrumb — reused across all portals (admin,
 * member, partner, instructor). Breadcrumb is derived from the current route:
 * the first segment is the portal root (links to its dashboard) and the rest
 * become crumbs.
 */
export function PageHeader({ title, subtitle, actions, crumbs: crumbsProp }: PageHeaderProps) {
  const router = useRouter();
  const segs = router.pathname.split("/").filter(Boolean);
  const root = segs[0] ?? "";
  const rootHref = root ? `/${root}/dashboard` : "/";
  // Drop the dashboard root and any dynamic route segments (e.g. "[id]").
  const tail = segs.slice(1).filter((s) => s !== "dashboard" && !/^\[.*\]$/.test(s));

  const crumbs: Crumb[] =
    crumbsProp && crumbsProp.length > 0
      ? crumbsProp
      : [
          { label: "Dashboard", href: rootHref },
          ...tail.map((seg, idx, arr) => ({
            label: LABEL_MAP[seg] ?? cap(seg),
            href: `/${root}/` + arr.slice(0, idx + 1).join("/"),
          })),
        ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sage/15 bg-white/95 px-5 py-4">
      <div className="min-w-0">
        <h1 className="truncate font-display text-xl leading-tight text-charcoal md:text-2xl">{title}</h1>
        {subtitle ? <p className="hidden truncate font-body text-sm text-charcoal/60 sm:block">{subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {actions}
        <Breadcrumb className="hidden md:block">
          <BreadcrumbList className="font-body text-sm text-charcoal/60">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <span key={`${c.label}-${i}`} className="contents">
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {last || !c.href ? (
                      <BreadcrumbPage className="text-charcoal">{c.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={c.href} className="hover:text-sage">
                          {c.label}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}

export default PageHeader;
