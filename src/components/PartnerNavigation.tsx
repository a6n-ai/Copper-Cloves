import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { LayoutDashboard, Calendar, LogOut, Settings, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon: LucideIcon };
type NavSection = { label: string; items: NavLink[] };

const navSections: NavSection[] = [
  {
    label: "Dashboard",
    items: [{ href: "/partner/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [{ href: "/partner/classes", label: "Classes", icon: Calendar }],
  },
  {
    label: "System",
    items: [{ href: "/partner/settings", label: "Settings", icon: Settings }],
  },
];

export function PartnerNavigation({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const [partnerName, setPartnerName] = useState("Partner");
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/partner/profile");
        if (res.ok && !cancelled) {
          const p = await res.json();
          setPartnerName(p.name ?? "Partner");
          setLogo(p.logo_url ?? null);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isActive = (href: string) => router.pathname === href;
  const initials = partnerName.slice(0, 2).toUpperCase();

  async function handleSignOut() {
    await signOut({ redirect: false });
    await router.replace("/login");
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-background": "0 0% 100%",
          "--sidebar-foreground": "20 14% 25%",
          "--sidebar-primary": "150 14% 45%",
          "--sidebar-primary-foreground": "0 0% 100%",
          "--sidebar-accent": "150 20% 95%",
          "--sidebar-accent-foreground": "150 14% 30%",
          "--sidebar-border": "150 14% 88%",
          "--sidebar-ring": "150 14% 45%",
        } as React.CSSProperties
      }
    >
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="px-3 pb-3">
          <div className="flex items-center gap-2">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={partnerName} className="h-9 w-9 rounded-full object-cover border border-sage/20" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-sage/10 flex items-center justify-center font-display text-sage text-sm">{initials}</div>
            )}
            <span className="font-display text-lg text-charcoal truncate group-data-[collapsible=icon]:hidden">{partnerName}</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {navSections.map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wider text-charcoal/40">
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          className={cn(
                            "rounded-md font-body transition-colors",
                            active && "bg-sage text-white hover:bg-sage hover:text-white data-[active=true]:bg-sage data-[active=true]:text-white",
                          )}
                        >
                          <Link href={item.href}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-sage/10 pt-3">
          <div className="flex items-center gap-3 px-2 pb-2 group-data-[collapsible=icon]:justify-center">
            <Avatar className="h-9 w-9 border-2 border-sage/20">
              {logo && <AvatarImage src={logo} alt={partnerName} />}
              <AvatarFallback className="bg-sage/10 text-sage font-display text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="font-body text-sm font-medium text-charcoal truncate">{partnerName}</p>
              <p className="font-body text-xs text-charcoal/50 truncate">Partner portal</p>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-sage/10 h-16 md:rounded-t-xl">
          <div className="flex items-center justify-between h-full px-4 gap-3">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-charcoal hover:text-sage shrink-0" />
              <span className="font-display text-lg text-charcoal hidden sm:inline">{partnerName}</span>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Badge className="hidden lg:inline-flex bg-sage text-white font-body">Partner Portal</Badge>
              <Separator orientation="vertical" className="hidden lg:block h-6" />
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="rounded-full cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-sage/40" aria-label="Profile">
                    <Avatar className="size-8 rounded-full ring-2 ring-sage/30">
                      {logo && <AvatarImage src={logo} alt={partnerName} />}
                      <AvatarFallback className="bg-sage/10 text-sage font-display text-sm">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex flex-col px-3 py-2.5 font-normal">
                      <span className="text-charcoal font-body font-semibold truncate">{partnerName}</span>
                      <span className="text-charcoal/60 text-xs">Partner portal</span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer gap-3 px-3 py-2">
                      <Link href="/partner/settings"><Settings size={16} /><span>Profile &amp; settings</span></Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer gap-3 px-3 py-2 text-terracotta focus:bg-terracotta/10 focus:text-terracotta"
                      onSelect={(e) => { e.preventDefault(); void handleSignOut(); }}
                    >
                      <LogOut size={16} /><span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
