import { Button } from "@/components/ui/button";
import { Calendar, Users, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export function Rental() {
  return (
    <section className="relative py-16 px-6 lg:px-8 overflow-hidden bg-cream">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-12">
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl text-charcoal mb-4">
            <span className="italic text-sage">Host</span> Your Event
          </h2>
          <p className="font-body text-xl text-charcoal/80 max-w-3xl mx-auto leading-relaxed">
            Transform our sanctuary into your canvas. Host workshops, celebrations, 
            gatherings, or corporate events in a space designed for connection.
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          {/* Left: Image Showcase */}
          <div className="relative">
            <div className="relative h-[500px] rounded-3xl overflow-hidden shadow-2xl">
              <Image
                src="/cafe-studio.jpg"
                alt="The Studio by Copper + Cloves - Event Space"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                quality={90}
              />
              <div className="absolute inset-0 bg-linear-to-t from-charcoal/60 via-transparent to-transparent" />
              
              {/* Floating Badge */}
              <div className="absolute bottom-8 left-8 right-8">
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-body text-sm text-charcoal/70 mb-1">Capacity</p>
                      <p className="font-display text-3xl text-charcoal">Up to 40 Guests</p>
                    </div>
                    <div className="w-16 h-16 rounded-full bg-sage/10 flex items-center justify-center">
                      <Users className="text-sage" size={32} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Features */}
          <div className="space-y-8">
            {/* Feature 1 */}
            <div className="flex gap-4">
              <div className="shrink-0 w-14 h-14 rounded-full bg-sage/10 flex items-center justify-center">
                <Sparkles className="text-sage" size={24} />
              </div>
              <div>
                <h3 className="font-display text-2xl text-charcoal mb-2">
                  Curated Ambiance
                </h3>
                <p className="font-body text-charcoal/70 leading-relaxed">
                  Thoughtfully designed interiors with natural light, tropical plants, 
                  and a warm aesthetic that elevates any gathering into something memorable.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-4">
              <div className="shrink-0 w-14 h-14 rounded-full bg-sage/10 flex items-center justify-center">
                <Calendar className="text-sage" size={24} />
              </div>
              <div>
                <h3 className="font-display text-2xl text-charcoal mb-2">
                  Flexible Scheduling
                </h3>
                <p className="font-body text-charcoal/70 leading-relaxed">
                  Available for half-day or full-day bookings. Perfect for workshops, 
                  team offsites, birthday celebrations, product launches, or intimate gatherings.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-4">
              <div className="shrink-0 w-14 h-14 rounded-full bg-sage/10 flex items-center justify-center">
                <Users className="text-sage" size={24} />
              </div>
              <div>
                <h3 className="font-display text-2xl text-charcoal mb-2">
                  Full-Service Experience
                </h3>
                <p className="font-body text-charcoal/70 leading-relaxed">
                  Add catering from our plant-based café, sound system setup, yoga mats, 
                  or custom arrangements. We'll handle the details so you can focus on your guests.
                </p>
              </div>
            </div>

            {/* CTA Button */}
            <Link href="/rental" className="inline-block">
              <Button 
                size="lg"
                className="bg-sage text-white hover:bg-sage/90 px-10 py-6 text-base rounded-full shadow-xl mt-4"
              >
                Explore Space & Book
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-6 rounded-2xl bg-white/50 backdrop-blur-xs border border-sage/10">
            <p className="font-display text-4xl text-sage mb-2">40+</p>
            <p className="font-body text-sm text-charcoal/70">Events Hosted</p>
          </div>
          <div className="text-center p-6 rounded-2xl bg-white/50 backdrop-blur-xs border border-sage/10">
            <p className="font-display text-4xl text-sage mb-2">1,000 sq ft +</p>
            <p className="font-body text-sm text-charcoal/70">Open Space</p>
          </div>
          <div className="text-center p-6 rounded-2xl bg-white/50 backdrop-blur-xs border border-sage/10">
            <p className="font-display text-4xl text-sage mb-2">Natural</p>
            <p className="font-body text-sm text-charcoal/70">Lighting</p>
          </div>
          <div className="text-center p-6 rounded-2xl bg-white/50 backdrop-blur-xs border border-sage/10">
            <p className="font-display text-4xl text-sage mb-2">Premium</p>
            <p className="font-body text-sm text-charcoal/70">Amenities</p>
          </div>
        </div>
      </div>
    </section>
  );
}