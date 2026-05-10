import Link from "next/link";
import { MapPin, Phone, Mail, Instagram, Facebook, Youtube } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-sage text-white">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Brand & Tagline */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-block mb-6">
              <img 
                src="/the_studio_by_C_C_og.png" 
                alt="The Studio by Copper + Cloves"
                className="h-16 w-auto brightness-0 invert"
              />
            </Link>
            <p className="font-body text-white/80 leading-relaxed mb-6">
              Your home away from home. Move your body, refuel with nourishing food, and find your community.
            </p>
            
            {/* Social Links */}
            <div className="flex items-center gap-4">
              <a 
                href="https://www.instagram.com/thestudiobycopperandcloves/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors duration-300 flex items-center justify-center group"
              >
                <Instagram size={20} className="text-white" />
              </a>
              <a 
                href="https://www.facebook.com/people/The-Studio-by-Copper-Cloves/61564386191595/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors duration-300 flex items-center justify-center group"
              >
                <Facebook size={20} className="text-white" />
              </a>
              <a 
                href="https://www.youtube.com/@CopperandCloves" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors duration-300 flex items-center justify-center group"
              >
                <Youtube size={20} className="text-white" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-display text-xl text-white mb-6">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/classes" className="font-body text-white/70 hover:text-white transition-colors duration-300">
                  Class Schedule
                </Link>
              </li>
              <li>
                <Link href="/cafe" className="font-body text-white/70 hover:text-white transition-colors duration-300">
                  The Café
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="font-body text-white/70 hover:text-white transition-colors duration-300">
                  Pricing & Packages
                </Link>
              </li>
              <li>
                <Link href="/#instructors" className="font-body text-white/70 hover:text-white transition-colors duration-300">
                  Our Instructors
                </Link>
              </li>
              <li>
                <Link href="/portal/login" className="font-body text-white/70 hover:text-white transition-colors duration-300">
                  Member Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Classes */}
          <div>
            <h3 className="font-display text-xl text-white mb-6">Our Classes</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/classes" className="font-body text-white/70 hover:text-white transition-colors duration-300">
                  Muay Thai Circuit Training
                </Link>
              </li>
              <li>
                <Link href="/classes" className="font-body text-white/70 hover:text-white transition-colors duration-300">
                  Hatha Yoga
                </Link>
              </li>
              <li>
                <Link href="/classes" className="font-body text-white/70 hover:text-white transition-colors duration-300">
                  Mat Pilates
                </Link>
              </li>
              <li>
                <Link href="/classes" className="font-body text-white/70 hover:text-white transition-colors duration-300">
                  Aerial Yoga
                </Link>
              </li>
              <li>
                <Link href="/classes" className="font-body text-white/70 hover:text-white transition-colors duration-300">
                  Physique 57
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-display text-xl text-white mb-6">Get in Touch</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="text-white mt-1 flex-shrink-0" size={20} />
                <div className="font-body text-white/70 leading-relaxed">
                  1226, 12th Main Road, HAL 2nd Stage,<br />
                  Indiranagar, Bengaluru,<br />
                  Karnataka 560038
                </div>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="text-white flex-shrink-0" size={20} />
                <a href="tel:+919008426703" className="font-body text-white/70 hover:text-white transition-colors duration-300">
                  +91 90084 26703
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="text-white flex-shrink-0" size={20} />
                <a href="mailto:thestudio@copperandcloves.com" className="font-body text-white/70 hover:text-white transition-colors duration-300">
                  thestudio@copperandcloves.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Map Section */}
        <div className="border-t border-white/20 pt-12 mb-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="font-display text-2xl md:text-3xl text-white mb-4">
                Visit Our Studio
              </h3>
              <p className="font-body text-white/70 leading-relaxed mb-6">
                Located in the heart of Indiranagar, our sun-drenched studio awaits. Drop by for a tour, grab a coffee, or join us for a class.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="https://maps.google.com/maps?ll=12.963915,77.638424&z=15&t=m&hl=en&gl=IN&mapclient=embed&cid=8196377345979611458"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-sage px-6 py-3 rounded-lg transition-colors duration-300 font-body justify-center"
                >
                  <MapPin size={18} />
                  Get Directions
                </a>
                <Link
                  href="/portal/book"
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg transition-colors duration-300 font-body justify-center"
                >
                  Book a Visit
                </Link>
              </div>
            </div>
            
            {/* Embedded Map */}
            <div className="rounded-xl overflow-hidden shadow-2xl h-[300px] md:h-[350px]">
              <iframe
                src="https://maps.google.com/maps?ll=12.963915,77.638424&z=15&t=m&hl=en&gl=IN&mapclient=embed&output=embed&cid=8196377345979611458"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="The Studio by Copper + Cloves Location"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-body text-white/60 text-sm text-center md:text-left">
              © {currentYear} The Studio by Copper + Cloves. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="font-body text-white/60 hover:text-white text-sm transition-colors duration-300">
                Privacy Policy
              </Link>
              <Link href="/terms" className="font-body text-white/60 hover:text-white text-sm transition-colors duration-300">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}