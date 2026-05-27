import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { cdnUrl } from "@/lib/cdnUrl";

const features = [
  { title: "Expert-led movement", description: "Yoga, Pilates, Strength, Cardio" },
  { title: "Plant-based café", description: "Smoothie bowls, salads, sourdough" },
  { title: "Space for connection", description: "Light-filled interiors and tropical greenery" }
];

const stats = [
  { value: "500+", label: "Members", position: "top-8 left-8" },
  { value: "15+", label: "Experts", position: "top-8 right-8" },
  { value: "25+", label: "Classes", position: "bottom-32 left-8" },
  { value: "5.0", label: "Rating", position: "bottom-32 right-8" }
];

export function Founder() {

  return (
    <section className="relative py-16 md:py-20 px-6 lg:px-8 overflow-hidden">
      {/* Subtle Background */}
      <div className="absolute inset-0 bg-linear-to-br from-cream via-white to-sage/5 -z-10" />
      
      <div className="max-w-7xl mx-auto">
        {/* Section Badge */}
        <div className="text-center mb-10 md:mb-12">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-sage/10 border border-sage/20 mb-6">
            <span className="font-body text-xs text-charcoal font-semibold tracking-widest uppercase">
              Our Story
            </span>
          </div>
        </div>

        {/* Split Editorial Grid */}
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-start">
          
          {/* LEFT SIDE - THE NARRATIVE */}
          <div className="space-y-8 lg:pr-8">
            {/* Vertical Serif Headline */}
            <div>
              <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-charcoal leading-tight mb-8">
                more than just a <br />fitness studio.
              </h2>
              
              {/* Main Body Copy */}
              <p className="font-body font-light text-lg text-charcoal/80 leading-relaxed mb-8" style={{ lineHeight: '1.6' }}>
                A wellness studio with movement, food, and community — all under one roof. At The Studio by Copper + Cloves, you'll find more than just classes — you'll find a <span className="font-display italic text-sage">sanctuary</span> from the city, designed to help you feel strong, <span className="font-display italic text-sage">nourished</span>, and <span className="font-display italic text-sage">connected</span>.
              </p>
            </div>

            {/* Minimalist Feature List */}
            <div className="space-y-6 pt-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-4">
                  {/* Sage Green Organic Dot */}
                  <div className="w-2 h-2 rounded-full bg-sage mt-2.5 shrink-0" />
                  
                  <div>
                    <p className="font-body text-base text-charcoal leading-relaxed">
                      <span className="font-semibold">{feature.title}:</span>{' '}
                      <span className="text-charcoal/70">{feature.description}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Closing Copy */}
            <div className="pt-6">
              <p className="font-body font-light text-lg text-charcoal/70 leading-relaxed italic" style={{ lineHeight: '1.6' }}>
                Whether you're here to build strength, eat well, or simply take a pause, The Studio is your space to recharge, connect, and grow.
              </p>
            </div>

            {/* Founder CTA — bordered pill, sage on hover */}
            <div className="pt-8">
              <Link
                href="/founder"
                className="group inline-flex items-center gap-3 rounded-xl border-2 border-charcoal/15 bg-white/80 px-6 py-4 font-body text-sm text-charcoal uppercase tracking-widest transition-all duration-300 hover:border-sage hover:bg-sage hover:text-white hover:shadow-lg"
              >
                <span>Meet the Founder</span>
                <ArrowRight
                  className="text-sage transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white"
                  size={18}
                />
              </Link>
            </div>
          </div>

          {/* RIGHT SIDE - THE VISUAL COLLAGE */}
          <div className="relative">
            {/* Asymmetric Image Collage */}
            <div className="relative h-[600px] lg:h-[700px]">
              
              {/* Main Wide Image - Studio Interior */}
              <div className="absolute top-0 left-0 right-0 h-[65%] rounded-3xl overflow-hidden shadow-2xl">
                <Image
                  src={cdnUrl("/cafe-studio.jpg")}
                  alt="Light-filled studio with tropical plants"
                  fill
                  className="object-cover"
                  quality={90}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                
                {/* Stat Overlays on Main Image */}
                {stats.slice(0, 2).map((stat, index) => (
                  <div 
                    key={index}
                    className={`absolute ${stat.position} bg-white/95 backdrop-blur-xs px-4 py-3 rounded-2xl shadow-lg border border-white/40`}
                  >
                    <p className="font-display text-3xl text-charcoal leading-none mb-1">
                      {stat.value}
                    </p>
                    <p className="font-body text-xs text-charcoal/60 uppercase tracking-wide">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Inset Image 1 - Smoothie Bowl (Bottom Left) */}
              <div className="absolute bottom-0 left-0 w-[45%] h-[32%] rounded-3xl overflow-hidden shadow-2xl">
                <Image
                  src={cdnUrl("/food/A7401864.jpg")}
                  alt="Vibrant smoothie bowl"
                  fill
                  className="object-cover"
                  quality={90}
                  sizes="(max-width: 768px) 45vw, 25vw"
                />
                
                {/* Stat Overlay */}
                <div className={`absolute ${stats[2].position} bg-white/95 backdrop-blur-xs px-4 py-3 rounded-2xl shadow-lg border border-white/40`}>
                  <p className="font-display text-3xl text-charcoal leading-none mb-1">
                    {stats[2].value}
                  </p>
                  <p className="font-body text-xs text-charcoal/60 uppercase tracking-wide">
                    {stats[2].label}
                  </p>
                </div>
              </div>

              {/* Inset Image 2 - Community Space (Bottom Right) */}
              <div className="absolute bottom-0 right-0 w-[50%] h-[32%] rounded-3xl overflow-hidden shadow-2xl">
                <Image
                  src={cdnUrl("/cafe-hero-shelves.jpg")}
                  alt="Community space with people connecting"
                  fill
                  className="object-cover"
                  quality={90}
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
                
                {/* Stat Overlay */}
                <div className={`absolute ${stats[3].position} bg-white/95 backdrop-blur-xs px-4 py-3 rounded-2xl shadow-lg border border-white/40`}>
                  <p className="font-display text-3xl text-charcoal leading-none mb-1">
                    {stats[3].value}
                  </p>
                  <p className="font-body text-xs text-charcoal/60 uppercase tracking-wide">
                    {stats[3].label}
                  </p>
                </div>
              </div>

              {/* Floating Testimonial - Glassmorphism */}
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-[90%] max-w-md">
                <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/40">
                  {/* Sage Quotation Mark Icon */}
                  <div className="absolute -top-4 left-8 w-12 h-12 rounded-full bg-sage flex items-center justify-center shadow-lg">
                    <span className="text-white text-3xl font-serif leading-none">"</span>
                  </div>
                  
                  {/* Testimonial Content */}
                  <div className="pt-4">
                    <p className="font-body text-base text-charcoal/80 leading-relaxed italic mb-4">
                      It's not just a gym — it's a community. The vibe is always calm, and I feel recharged every time I leave.
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-display text-lg text-charcoal">Anna</p>
                        <p className="font-body text-sm text-charcoal/60">Member since 2023</p>
                      </div>
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <svg key={i} className="w-4 h-4 text-sage fill-current" viewBox="0 0 20 20">
                            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-Only: Single Impact Image with Stats */}
      <style jsx>{`
        @media (max-width: 1023px) {
          .lg\\:grid-cols-2 > div:last-child > div > div:nth-child(2),
          .lg\\:grid-cols-2 > div:last-child > div > div:nth-child(3) {
            display: none;
          }
          
          .lg\\:grid-cols-2 > div:last-child > div > div:first-child {
            height: 500px !important;
          }
        }
      `}</style>
    </section>
  );
}