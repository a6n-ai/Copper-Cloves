import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-white/60 backdrop-blur-xl shadow-sm sticky top-0 z-50 border-b border-sage/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo/Brand */}
          <Link href="/" className="flex flex-col leading-none group">
            <span className="font-display text-2xl text-charcoal italic tracking-tight">
              the<span className="font-normal not-italic uppercase tracking-wider">STUDIO</span>
            </span>
            <span className="font-body text-[10px] text-charcoal/60 tracking-widest uppercase mt-0.5">
              by COPPER+CLOVES
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/classes" className="font-body text-charcoal hover:text-sage transition-colors">
              Classes
            </Link>
            <Link href="/#instructors" className="font-body text-charcoal hover:text-sage transition-colors">
              Instructors
            </Link>
            <Link href="/#pricing" className="font-body text-charcoal hover:text-sage transition-colors">
              Pricing
            </Link>
            <Link href="/cafe" className="font-body text-charcoal hover:text-sage transition-colors">
              Café
            </Link>
            <Link href="/portal/login">
              <Button className="bg-sage hover:bg-sage/90 text-white font-body px-6">
                Book Now
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-sage/10 transition-colors"
          >
            {mobileMenuOpen ? (
              <X size={24} className="text-charcoal" />
            ) : (
              <Menu size={24} className="text-charcoal" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-6 pt-2 space-y-3">
            <Link 
              href="/classes" 
              className="block font-body text-charcoal hover:text-sage transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Classes
            </Link>
            <Link 
              href="/#instructors" 
              className="block font-body text-charcoal hover:text-sage transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Instructors
            </Link>
            <Link 
              href="/#pricing" 
              className="block font-body text-charcoal hover:text-sage transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link 
              href="/cafe" 
              className="block font-body text-charcoal hover:text-sage transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Café
            </Link>
            <Link href="/portal/login" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full bg-sage hover:bg-sage/90 text-white font-body">
                Book Now
              </Button>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}