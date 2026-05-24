import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { LogOut, BellRing, User as UserIcon, Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cdnUrl } from "@/lib/cdnUrl";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { CheckinBeacon } from "@/components/checkin/CheckinBeacon";
import { SIGN_OUT_HREF, type NavSection, type PortalConfig } from "@/components/dashboard/dashboardNav";
import { MobileBottomNav } from "@/components/responsive/MobileBottomNav";

export interface DashboardUser {
  name: string;
  email?: string;
  /** Brand logo (partner) — falls back to initials. */
  logoUrl?: string | null;
}

export interface DashboardShellProps {
  config: PortalConfig;
  user: DashboardUser;
  children?: React.ReactNode;
}

const SIDEBAR_THEME = {
  "--sidebar-width": "16rem",
  "--sidebar-background": "0 0% 100%",
  "--sidebar-foreground": "20 14% 25%",
  "--sidebar-primary": "150 14% 45%",
  "--sidebar-primary-foreground": "0 0% 100%",
  "--sidebar-accent": "150 20% 95%",
  "--sidebar-accent-foreground": "150 14% 30%",
  "--sidebar-border": "150 14% 88%",
  "--sidebar-ring": "150 14% 45%",
} as React.CSSProperties;

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function SearchCommand({ sections }: { sections: NavSection[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 30);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    void router.push(href);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 w-full max-w-xs rounded-full border border-sage/20 bg-white/70 px-3 py-1.5 text-left text-sm text-charcoal/50 hover:border-sage/40 transition-colors"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 truncate font-body">Search pages…</span>
          <kbd className="hidden sm:inline rounded border border-sage/20 bg-cream/50 px-1.5 text-[10px] font-body text-charcoal/50">
            ⌘K
          </kbd>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(380px,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput ref={inputRef} placeholder="Search pages…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No pages found.</CommandEmpty>
            {sections.map((section) => (
              <CommandGroup key={section.label} heading={section.label}>
                {section.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${item.label} ${item.href}`}
                    onSelect={() => go(item.href)}
                    className="cursor-pointer"
                  >
                    <item.icon className="mr-2 h-4 w-4 text-sage" />
                    <div className="flex flex-col">
                      <span className="font-body text-sm text-charcoal">{item.label}</span>
                      <span className="font-body text-xs text-charcoal/50">{item.href}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function DashboardShell({ config, user, children }: DashboardShellProps) {
  const router = useRouter();
  // Active when on the exact route or any sub-route (e.g. /admin/schedule/[id] → Schedule).
  const isActive = (href: string) =>
    router.pathname === href || router.pathname.startsWith(`${href}/`);
  const initials = getInitials(user.name);
  const isPartner = config.kind === "partner";
  const isMember = config.kind === "member";

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    await router.replace(SIGN_OUT_HREF);
  };

  return (
    <SidebarProvider style={SIDEBAR_THEME}>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="px-3 pb-3">
          {isPartner ? (
            <div className="flex items-center gap-2">
              {user.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.logoUrl}
                  alt={user.name}
                  className="h-9 w-9 rounded-full object-cover border border-sage/20"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-sage/10 flex items-center justify-center font-display text-sage text-sm">
                  {initials}
                </div>
              )}
              <span className="font-display text-lg text-charcoal truncate group-data-[collapsible=icon]:hidden">
                {user.name}
              </span>
            </div>
          ) : (
            <Link href="/" className="flex items-center gap-2 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cdnUrl("/logo2.png")}
                alt="The Studio Logo"
                className="h-10 w-auto group-hover:scale-105 transition-transform duration-300 group-data-[collapsible=icon]:hidden"
                style={{ filter: "brightness(0)" }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cdnUrl("/favicon.svg")}
                alt="The Studio"
                className="hidden h-8 w-8 group-data-[collapsible=icon]:block"
              />
            </Link>
          )}
        </SidebarHeader>

        <SidebarContent>
          {config.sections.map((section) => (
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
                            active &&
                              "bg-sage text-white hover:bg-sage hover:text-white data-[active=true]:bg-sage data-[active=true]:text-white",
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
              {user.logoUrl ? <AvatarImage src={user.logoUrl} alt={user.name} /> : null}
              <AvatarFallback className="bg-sage/10 text-sage font-display text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="font-body text-sm font-medium text-charcoal truncate">{user.name}</p>
              <p className="font-body text-xs text-charcoal/50 truncate">{user.email || config.subtitle}</p>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {config.kind === "admin" ? <CheckinBeacon /> : null}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-sage/10 h-16 md:rounded-t-xl">
          <div className="flex items-center justify-between h-full px-4 gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <SidebarTrigger className="text-charcoal hover:text-sage shrink-0" />
              <div className="flex-1 max-w-md">
                <SearchCommand sections={config.sections} />
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <RoleSwitcher className="hidden sm:inline-flex" />
              <Badge className={cn("hidden lg:inline-flex font-body", config.badgeClass)}>{config.badgeLabel}</Badge>
              <Separator orientation="vertical" className="hidden lg:block h-6" />
              <button
                type="button"
                aria-label="Notifications"
                className="relative rounded-full p-2 hover:bg-sage/10 transition-colors before:absolute before:top-1 before:left-1/2 before:z-10 before:w-2 before:h-2 before:rounded-full before:bg-terracotta"
              >
                <BellRing className="size-4 text-charcoal" />
              </button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-sage/40"
                    aria-label="Profile"
                  >
                    <Avatar className="size-8 rounded-full ring-2 ring-sage/30">
                      {user.logoUrl ? <AvatarImage src={user.logoUrl} alt={user.name} /> : null}
                      <AvatarFallback className="bg-sage/10 text-sage font-display text-sm">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex items-center gap-3 px-3 py-2.5 font-normal">
                      <div className="relative">
                        <Avatar className="size-10">
                          {user.logoUrl ? <AvatarImage src={user.logoUrl} alt={user.name} /> : null}
                          <AvatarFallback className="bg-sage/10 text-sage font-display">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="ring-card absolute right-0 bottom-0 size-2 rounded-full bg-green-600 ring-2" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-charcoal font-body font-semibold truncate">{user.name}</span>
                        <span className="text-charcoal/60 text-xs truncate">{user.email || config.subtitle}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {config.accountHref ? (
                      <>
                        <DropdownMenuItem asChild className="cursor-pointer gap-3 px-3 py-2">
                          <Link href={config.accountHref}>
                            <UserIcon size={16} />
                            <span>{config.accountLabel ?? "Account Settings"}</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    ) : null}
                    <DropdownMenuItem
                      className="cursor-pointer gap-3 px-3 py-2 text-terracotta focus:bg-terracotta/10 focus:text-terracotta"
                      onSelect={(e) => {
                        e.preventDefault();
                        void handleSignOut();
                      }}
                    >
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <div className={cn("flex-1", isMember && "pb-20 md:pb-0")}>{children}</div>
      </SidebarInset>
      {isMember && <MobileBottomNav />}
    </SidebarProvider>
  );
}
