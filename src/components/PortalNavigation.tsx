import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, 
  Calendar, 
  Package, 
  User, 
  Menu, 
  X,
  LogOut,
  CreditCard,
  ChevronRight,
  CalendarCheck
} from "lucide-react";

interface PortalNavigationProps {
  userName?: string;
  userEmail?: string;
  creditsRemaining?: number;
  currentBadge?: string;
}

export function PortalNavigation({ 
  userName = "Welcome Back", 
  userEmail = "member@studio.com",
  creditsRemaining = 12,
  currentBadge = "The Seeker"
}: PortalNavigationProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { href: "/portal/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Your overview" },
    { href: "/portal/book", label: "Book Class", icon: Calendar, description: "Reserve your spot" },
    { href: "/portal/bookings", label: "My Bookings", icon: CalendarCheck, description: "View reservations" },
    { href: "/portal/packages", label: "Packages", icon: Package, description: "View & purchase" },
    { href: "/portal/profile", label: "Profile", icon: User, description: "Account settings" },
  ];

  const isActive = (path: string) => router.pathname === path;

  const handleSignOut = async () => {
    // TODO: Implement sign out
    router.push("/portal/login");
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <>
      {/* Header with Hamburger for All Screen Sizes */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-sage/10 shadow-sm h-16">
        <div className="flex items-center justify-between h-full px-4">
          {/* Left Side: Hamburger + Logo */}
          <div className="flex items-center gap-4">
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg hover:bg-sage/10 transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <X size={24} className="text-charcoal" />
              ) : (
                <Menu size={24} className="text-charcoal" />
              )}
            </button>

            {/* Logo - Back to Home */}
            <Link href="/" className="flex items-center gap-3 group">
              <img 
                src="/logo2.png" 
                alt="The Studio Logo" 
                className="h-12 w-auto group-hover:scale-105 transition-transform duration-300"
                style={{ filter: 'brightness(0)' }}
              />
            </Link>

            {/* Member Badge */}
            <Badge className="bg-sage text-white font-body hidden sm:block">
              Member Portal
            </Badge>
          </div>
        </div>
      </header>

      {/* Overlay for all screen sizes */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-40 animate-in fade-in duration-600"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Drawer for All Screen Sizes */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-80 bg-white/95 backdrop-blur-2xl shadow-2xl z-50 transform transition-all duration-600 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* User Profile Section */}
          <div className="p-6 bg-gradient-to-br from-cream/50 to-white border-b border-sage/10">
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="h-16 w-16 border-2 border-sage/20">
                <AvatarFallback className="bg-sage/10 text-sage font-display text-xl">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-xl text-charcoal truncate">{userName}</h3>
                <p className="font-body text-sm text-charcoal/60 truncate">{userEmail}</p>
                <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full bg-sage/10 text-sage text-xs font-body border border-sage/20">
                  {currentBadge}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <p className="font-body text-xs text-charcoal/40 uppercase tracking-wider mb-3 px-2">Menu</p>
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-600 ${
                      active
                        ? "bg-sage text-white shadow-lg"
                        : "text-charcoal hover:bg-sage/10 hover:translate-x-1"
                    }`}
                  >
                    <div className={`p-2 rounded-lg transition-colors duration-600 ${
                      active ? "bg-white/20" : "bg-sage/10 group-hover:bg-sage/20"
                    }`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="font-body font-medium">{item.label}</p>
                      <p className={`font-body text-xs transition-colors duration-600 ${
                        active ? "text-white/70" : "text-charcoal/50"
                      }`}>
                        {item.description}
                      </p>
                    </div>
                    {active && <ChevronRight size={16} />}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Sign Out Button */}
          <div className="p-4 border-t border-sage/10 bg-gradient-to-t from-cream/30 to-white">
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="w-full justify-start text-terracotta border-terracotta/20 hover:bg-terracotta/10 hover:border-terracotta/40 h-12 font-body transition-all duration-600"
            >
              <LogOut size={20} className="mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}