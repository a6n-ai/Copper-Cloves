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

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

const LABEL_MAP: Record<string, string> = {
  admin: "Admin",
  dashboard: "Dashboard",
  schedule: "Schedule",
  members: "Members",
  credits: "Credits",
  badges: "Badges",
  cafe: "Café Menu",
  products: "Products",
  control: "Settings",
  CRM: "CRM",
};

export function AdminPageHeader({ title, subtitle, actions }: AdminPageHeaderProps) {
  const router = useRouter();
  // Drop "admin" prefix segment; breadcrumb always starts at Dashboard.
  const tailSegs = router.pathname.split("/").filter(Boolean).filter((s) => s !== "admin");
  const tailCrumbs = tailSegs
    .filter((seg) => seg !== "dashboard")
    .map((seg, idx, arr) => ({
      label: LABEL_MAP[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1),
      href: "/admin/" + arr.slice(0, idx + 1).join("/"),
    }));
  const crumbs = [{ label: "Dashboard", href: "/admin/dashboard" }, ...tailCrumbs];

  return (
    <div className="rounded-xl border border-sage/15 bg-white/95 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-xl md:text-2xl text-charcoal leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="font-body text-sm text-charcoal/60 truncate">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-4 flex-wrap">
      {actions}
      <Breadcrumb>
        <BreadcrumbList className="text-charcoal/60 font-body text-sm">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <span key={c.href} className="contents">
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {last ? (
                    <BreadcrumbPage className="text-charcoal">{c.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={c.href} className="hover:text-sage">{c.label}</Link>
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

export default AdminPageHeader;
