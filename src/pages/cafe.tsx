import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { SEO } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Leaf, 
  Heart, 
  Coffee,
  Apple,
  Droplets,
  Calendar,
  Users,
  Sparkles,
  ArrowRight,
  Wifi,
  Zap,
  Volume2,
  MapPin
} from "lucide-react";

import { cdnUrl } from "@/lib/cdnUrl";

const analogImages = [
  cdnUrl("/events/Analog-0.jpeg"),
  cdnUrl("/events/Analog-1.jpeg"),
  cdnUrl("/events/Analog-2.jpeg"),
  cdnUrl("/events/Analog-3.jpeg"),
  cdnUrl("/events/Analog-4.jpeg")
];

const heroMedia = [
  { type: "video", src: cdnUrl("/Refuel-1.mp4") },
  { type: "image", src: cdnUrl("/meal-sub-2.jpg") },
  { type: "video", src: cdnUrl("/refuel-3.mp4") },
  { type: "image", src: cdnUrl("/food/BAG02716.jpg") },
  { type: "image", src: cdnUrl("/meal-sub-1.jpg") },
  { type: "image", src: cdnUrl("/food/A7404719.jpg") }
];

const galleryImages = [
  cdnUrl("/food/A7401864.jpg"),
  cdnUrl("/food/A7403685.jpg"),
  cdnUrl("/food/A7403837.jpg"),
  cdnUrl("/food/A7403872.jpg"),
  cdnUrl("/food/A7403877.jpg"),
  cdnUrl("/food/A7403883.jpg"),
  cdnUrl("/food/A7404545.jpg"),
  cdnUrl("/food/A7404719.jpg"),
  cdnUrl("/food/A7404723.jpg"),
  cdnUrl("/food/A7404737.jpg"),
  cdnUrl("/food/A7406773.jpg"),
  cdnUrl("/food/A7406776.jpg"),
  cdnUrl("/food/BAG02663.jpg"),
  cdnUrl("/food/BAG02716.jpg"),
  cdnUrl("/food/BAG02721.jpg"),
  cdnUrl("/food/BAG02755.jpg"),
  cdnUrl("/food/BAG02768.jpg"),
  cdnUrl("/food/BAG02801.jpg"),
  cdnUrl("/food/BAG08771.jpg"),
  cdnUrl("/food/BAG09447.jpg"),
  cdnUrl("/food/DSC05959.jpg"),
  cdnUrl("/food/BAG09574.jpg")
];

function getBackgroundColor(scrollY: number) {
  const transitionStart = 800;
  const transitionEnd = 1400;
  if (scrollY < transitionStart) return "rgb(255, 255, 255)";
  if (scrollY > transitionEnd) return "rgb(245, 235, 220)";
  const progress = (scrollY - transitionStart) / (transitionEnd - transitionStart);
  const r = Math.round(255 + (245 - 255) * progress);
  const g = Math.round(255 + (235 - 255) * progress);
  const b = Math.round(255 + (220 - 255) * progress);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function CafePage() {
  const [analogImageIndex, setAnalogImageIndex] = useState(0);
  const [heroMediaIndex, setHeroMediaIndex] = useState(0);
  const bgRef = useRef<HTMLDivElement>(null);

  // rAF-throttled scroll. The scroll position drives only the fixed background
  // color, so write it straight to the DOM node instead of routing through
  // React state — that previously re-rendered this entire ~1000-line page on
  // every scroll frame.
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const el = bgRef.current;
        if (el) el.style.backgroundColor = getBackgroundColor(window.scrollY);
        ticking = false;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnalogImageIndex((prev) => (prev + 1) % analogImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroMediaIndex((prev) => (prev + 1) % heroMedia.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const menuCategories = [
    {
      icon: Apple,
      title: "Post-Workout Fuel",
      items: ["Smoothie Bowls", "Protein Shakes", "Bliss Balls"],
      image: cdnUrl("/food/A7401864.jpg")
    },
    {
      icon: Coffee,
      title: "The Daily Pause",
      items: ["Sourdough Toasties", "Seasonal Salads", "Nourish Bowls"],
      image: cdnUrl("/food/BAG02768.jpg")
    },
    {
      icon: Droplets,
      title: "Liquid Energy",
      items: ["Specialty Coffee", "Matcha Lattes", "Kombucha bar"],
      image: cdnUrl("/food/A7404719.jpg")
    }
  ];

  return (
    <>
      <SEO 
        title="Café & Community | The Studio by Copper + Cloves"
        description="Nourish your body with plant-based meals and belong to a vibrant community. Join us for The Analog Club and Sober Sundowners."
      />
      
      <Navigation />

      {/* Dynamic Background with Lime-Plaster Texture */}
      <div
        ref={bgRef}
        className="fixed inset-0 -z-10 transition-colors duration-1000"
        style={{
          backgroundColor: getBackgroundColor(0),
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.08'/%3E%3C/svg%3E")`,
          backgroundBlendMode: "multiply"
        }}
      />

      {/* ===== SECTION 1: THE CAFÉ (NOURISH) ===== */}
      
      {/* Hero Section with Vertical Split Media */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden pt-20">
        {/* Vertical Split Media Background */}
        <div className="absolute inset-0 z-0">
          {/* Left Media - Vertical Split (50%) */}
          <div 
            className="absolute inset-0"
            style={{
              clipPath: "polygon(0 0, 50% 0, 50% 100%, 0 100%)"
            }}
          >
            {heroMedia.map((media, index) => (
              <div
                key={`left-${index}`}
                className="absolute inset-0 transition-opacity duration-2000"
                style={{
                  opacity: index === heroMediaIndex ? 1 : 0,
                  zIndex: index === heroMediaIndex ? 1 : 0
                }}
              >
                {media.type === "video" ? (
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full animate-subtle-float"
                    style={{ 
                      objectFit: 'cover',
                      objectPosition: 'center center',
                      filter: 'contrast(1.1) saturate(1.15)'
                    }}
                  >
                    <source src={media.src} type="video/mp4" />
                  </video>
                ) : (
                  <Image
                    src={media.src}
                    alt="Nourishment"
                    fill
                    sizes="100vw"
                    className="animate-subtle-float"
                    style={{ 
                      objectFit: 'cover',
                      objectPosition: 'center center',
                      filter: 'contrast(1.1) saturate(1.15)'
                    }}
                    quality={95}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Right Media - Vertical Split (50%) */}
          <div 
            className="absolute inset-0"
            style={{
              clipPath: "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)"
            }}
          >
            {heroMedia.map((media, index) => {
              const rightIndex = (heroMediaIndex + 3) % heroMedia.length;
              const isVisible = index === rightIndex;
              const rightMedia = heroMedia[rightIndex];
              
              return (
                <div
                  key={`right-${index}`}
                  className="absolute inset-0 transition-opacity duration-2000"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    zIndex: isVisible ? 1 : 0
                  }}
                >
                  {isVisible && rightMedia.type === "video" ? (
                    <video
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full animate-subtle-float-reverse"
                      style={{ 
                        objectFit: 'cover',
                        objectPosition: 'center center',
                        filter: 'contrast(1.1) saturate(1.15)'
                      }}
                    >
                      <source src={rightMedia.src} type="video/mp4" />
                    </video>
                  ) : isVisible && rightMedia.type === "image" ? (
                    <Image
                      src={rightMedia.src}
                      alt="Nourishment"
                      fill
                      sizes="100vw"
                      className="animate-subtle-float-reverse"
                      style={{ 
                        objectFit: 'cover',
                        objectPosition: 'center center',
                        filter: 'contrast(1.1) saturate(1.15)'
                      }}
                      quality={95}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Gradient Overlay for Text Readability */}
          <div className="absolute inset-0 bg-linear-to-r from-charcoal/80 via-charcoal/60 to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative z-20 max-w-7xl mx-auto px-6 lg:px-8 py-32">
          {/* Badge - Far Left */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage/30 backdrop-blur-2xl border border-sage/40">
              <Leaf className="text-sage" size={14} />
              <span className="font-body text-xs text-white font-semibold tracking-wide">100% PLANT-BASED DAILY RITUAL</span>
            </div>
          </div>

          {/* Centered Content */}
          <div className="max-w-4xl mx-auto text-center">
            {/* Main Headline */}
            <h1 className="font-display text-6xl md:text-7xl lg:text-8xl text-white leading-[1.05] mb-8">
              <span className="italic text-white/90">Nourishment for the</span><br />
              Soul, Fuel for the Body.
            </h1>

            {/* Subheadline */}
            <p className="font-body text-2xl md:text-3xl text-white/95 leading-relaxed mb-6 max-w-3xl mx-auto font-light">
              Your wellness journey continues beyond the mat. Refuel with chef-crafted, plant-based meals.
            </p>

            <p className="font-body text-xl text-white/85 leading-relaxed mb-12 max-w-2xl mx-auto">
              Meals that restore, energize, and nourish from the inside out.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/cafe/meal-subscription">
                <Button
                  size="lg"
                  variant="sage"
                  className="px-10 py-6 text-base rounded-full shadow-2xl"
                >
                  Explore the Menu
                  <ArrowRight className="ml-2" size={20} />
                </Button>
              </Link>
              <Link href="/cafe/meal-subscription">
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-2 border-white/40 hover:bg-white/10 text-white backdrop-blur-xs px-10 py-6 text-base rounded-full transition-all duration-300"
                >
                  Subscribe to Meal Subscription
                </Button>
              </Link>
              <a
                href="https://www.google.com/maps/search/?api=1&query=The+Studio+by+Copper+and+Cloves"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-2 border-white/40 hover:bg-white/10 text-white backdrop-blur-xs px-10 py-6 text-base rounded-full transition-all duration-300"
                >
                  <MapPin className="mr-2" size={20} />
                  Find Our Location
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Subtle Float Animation Styles - Like Landing Page */}
        <style jsx>{`
          @keyframes subtle-float {
            0%, 100% {
              transform: translateY(0%) scale(1.0);
            }
            25% {
              transform: translateY(-1%) scale(1.02);
            }
            50% {
              transform: translateY(0%) scale(1.03);
            }
            75% {
              transform: translateY(1%) scale(1.02);
            }
          }

          @keyframes subtle-float-reverse {
            0%, 100% {
              transform: translateY(0%) scale(1.0);
            }
            25% {
              transform: translateY(1%) scale(1.02);
            }
            50% {
              transform: translateY(0%) scale(1.03);
            }
            75% {
              transform: translateY(-1%) scale(1.02);
            }
          }

          .animate-subtle-float {
            animation: subtle-float 20s ease-in-out infinite;
          }

          .animate-subtle-float-reverse {
            animation: subtle-float-reverse 20s ease-in-out infinite;
          }
        `}</style>
      </section>

      {/* Open Invitation Section - Public Welcome */}
      <section className="relative py-20 px-6 lg:px-8 overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute inset-0 bg-linear-to-br from-sage/5 via-cream to-white -z-10" />
        
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage/10 border border-sage/20 mb-6">
                <Coffee className="text-sage" size={16} />
                <span className="font-body text-xs text-charcoal font-medium tracking-wide">OPEN TO ALL</span>
              </div>
              
              <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-charcoal mb-6 leading-tight">
                A Sanctuary for Your Best Work.
              </h2>
              
              <p className="font-body text-lg text-charcoal/80 leading-relaxed mb-8">
                No membership? No problem. Our doors are open to everyone—whether you're here for a post-class refuel or looking for a sun-drenched space to focus. With high-speed Wi-Fi, premium coffee, and a lush rooftop vibe, consider this your home away from home for the day.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="https://www.google.com/maps/search/?api=1&query=The+Studio+by+Copper+and+Cloves"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    size="lg"
                    variant="sage"
                    className="px-8 py-6 text-base rounded-full w-full sm:w-auto"
                  >
                    <MapPin className="mr-2" size={20} />
                    Find Our Location
                  </Button>
                </a>
                <Link href="/cafe/meal-subscription">
                  <Button 
                    size="lg"
                    variant="outline"
                    className="border-2 border-sage/30 hover:bg-sage/5 text-charcoal px-8 py-6 text-base rounded-full w-full sm:w-auto"
                  >
                    View Full Menu
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Right: Lifestyle Image */}
            <div className="relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <Image
                  src={cdnUrl("/coworking.jpg")}
                  alt="Co-working at The Studio - Laptop, coffee, and community"
                  width={600}
                  height={450}
                  className="w-full h-auto object-cover"
                  quality={90}
                />
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-charcoal/20 to-transparent" />
              </div>
              
              {/* Floating Stats Badge */}
              <div className="absolute -bottom-6 -right-6 bg-white/95 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-sage/10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-sage/10 flex items-center justify-center">
                    <Wifi className="text-sage" size={28} />
                  </div>
                  <div>
                    <p className="font-display text-2xl text-charcoal">High-Speed</p>
                    <p className="font-body text-sm text-charcoal/60">Wi-Fi & Power</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Co-working Features Grid */}
      <section className="relative py-16 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1: Fast Wi-Fi */}
            <div className="group text-center p-8 rounded-3xl bg-white/60 backdrop-blur-xs border border-sage/10 hover:border-sage/30 transition-all duration-300 hover:shadow-lg">
              <div className="w-16 h-16 rounded-full bg-sage/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-sage/20 transition-colors">
                <Wifi className="text-sage" size={32} />
              </div>
              <h3 className="font-display text-2xl text-charcoal mb-3">Fast Wi-Fi</h3>
              <p className="font-body text-charcoal/70 leading-relaxed">
                High-speed connectivity for global citizens who need reliable internet.
              </p>
            </div>
            
            {/* Feature 2: Power & Comfort */}
            <div className="group text-center p-8 rounded-3xl bg-white/60 backdrop-blur-xs border border-sage/10 hover:border-sage/30 transition-all duration-300 hover:shadow-lg">
              <div className="w-16 h-16 rounded-full bg-sage/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-sage/20 transition-colors">
                <Zap className="text-sage" size={32} />
              </div>
              <h3 className="font-display text-2xl text-charcoal mb-3">Power & Comfort</h3>
              <p className="font-body text-charcoal/70 leading-relaxed">
                Plentiful charging points and ergonomic seating amidst tropical greenery.
              </p>
            </div>
            
            {/* Feature 3: Quiet Zones */}
            <div className="group text-center p-8 rounded-3xl bg-white/60 backdrop-blur-xs border border-sage/10 hover:border-sage/30 transition-all duration-300 hover:shadow-lg">
              <div className="w-16 h-16 rounded-full bg-sage/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-sage/20 transition-colors">
                <Volume2 className="text-sage" size={32} />
              </div>
              <h3 className="font-display text-2xl text-charcoal mb-3">Quiet Zones</h3>
              <p className="font-body text-charcoal/70 leading-relaxed">
                A sanctuary from the city bustle, designed for deep focus and productivity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Digital Menu - Glassmorphism Cards */}
      <section className="relative py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl text-charcoal mb-4">
              Our Cafe Offerings
            </h2>
            <p className="font-body text-lg text-charcoal/70 max-w-2xl mx-auto mb-4">
              Every dish, every sip, every moment is crafted to complement your practice
            </p>
            
            {/* Subtle Tag */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage/10 border border-sage/20">
              <Coffee className="text-sage" size={14} />
              <span className="font-body text-xs text-charcoal/70">Available for Dine-in, Work-from-Cafe, or Takeaway</span>
            </div>
          </div>

          {/* Menu Promo-Banner Grid — re-skin of shadcn-space product-listing-04.
              Image-led, read-only (public page has no cart). */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {menuCategories.map((category, i) => {
              const Icon = category.icon;
              return (
                <div
                  key={category.title}
                  style={{ animationDelay: `${i * 90}ms` }}
                  className="group relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-2xl border border-border bg-charcoal shadow-none transition-all duration-500 fade-in-0 slide-in-from-bottom-4 fill-mode-both animate-in hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(51,51,51,0.16)]"
                >
                  <Image
                    src={category.image}
                    alt={category.title}
                    width={800}
                    height={1000}
                    unoptimized
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  {/* Warm legibility scrim — not decorative blur */}
                  <div className="absolute inset-0 bg-linear-to-t from-charcoal/85 via-charcoal/35 to-transparent" />

                  <div className="relative z-10 p-7">
                    <div className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-terracotta text-white-warm">
                      <Icon size={22} />
                    </div>
                    <h3 className="mb-3 font-display text-2xl text-white-warm">
                      {category.title}
                    </h3>
                    <ul className="space-y-1.5">
                      {category.items.map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-2 font-body text-sm text-white-warm/85"
                        >
                          <span className="size-1.5 rounded-full bg-terracotta" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* The Daily Ritual — meal-subscription CTA. Flat white-warm card,
              terracotta-accented icon (food context), sage owns the CTA. */}
          <div className="max-w-4xl mx-auto">
            <Card className="overflow-hidden rounded-2xl border border-border bg-white-warm shadow-none transition-shadow duration-300 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
              <CardContent className="p-8 md:p-12">
                <div className="flex flex-col items-start gap-6 sm:flex-row">
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-terracotta">
                    <Heart size={30} />
                  </div>

                  <div className="flex-1">
                    <h3 className="mb-4 font-display text-3xl font-semibold text-charcoal md:text-4xl">
                      <span className="italic text-charcoal/60">The</span> Daily Ritual
                    </h3>
                    <p className="mb-6 max-w-prose font-body text-lg leading-relaxed text-charcoal/80">
                      Struggling to eat clean? Guarantee yourself chef-prepared, plant-based meals
                      every day with our Studio Meal Subscription. Make wellness effortless.
                    </p>

                    <div className="flex flex-col gap-4 sm:flex-row">
                      <Link href="/cafe/meal-subscription">
                        <Button size="lg" variant="sage" className="w-full sm:w-auto">
                          Subscribe to Intentful Eating
                        </Button>
                      </Link>
                      <Link href="/cafe/meal-subscription">
                        <Button size="lg" variant="sage-outline" className="w-full sm:w-auto">
                          Learn More
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Nutritionist CTA Section */}
      <section className="relative py-16 px-6 lg:px-8 bg-linear-to-br from-sage/5 to-cream">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-body text-xl text-charcoal/80 leading-relaxed">
            Not sure what your body needs? <Link href="/cafe/meal-subscription" className="text-sage font-semibold underline hover:text-sage/80 transition-colors">Connect with our in-house nutritionist</Link> for personalized guidance.
          </p>
        </div>
      </section>

      {/* ===== NOURISH GALLERY — horizontal marquee on all viewports (same as mobile) ===== */}
      <section className="relative w-full min-h-[50vh] md:min-h-[60vh] bg-white overflow-hidden">
        {/* Watermark — behind scrolling strip */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-1">
          <h2 className="font-display text-7xl sm:text-8xl md:text-9xl text-charcoal select-none tracking-wider italic opacity-[0.12] md:opacity-80">
            GATHER
          </h2>
        </div>

        <div className="relative z-10 py-16 md:py-24 overflow-x-auto overflow-y-hidden scrollbar-hide">
          <div className="flex gap-6 md:gap-8 px-6 md:px-10 w-max max-w-none animate-scroll-smooth">
            {[...galleryImages, ...galleryImages].map((image, index) => (
              <div
                key={`${image}-${index}`}
                className="relative shrink-0 w-[260px] h-[320px] sm:w-[280px] sm:h-[350px] md:w-[300px] md:h-[380px] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl transition-transform duration-500 hover:scale-[1.02] hover:shadow-sage/25"
                style={{
                  animation: `float-gentle ${3 + (index % 3)}s ease-in-out infinite`,
                  animationDelay: `${index * 0.15}s`,
                }}
              >
                <Image
                  src={image}
                  alt={`Nourishment ${index + 1}`}
                  fill
                  sizes="(max-width: 768px) 280px, 300px"
                  className="object-cover transition-transform duration-700"
                  quality={85}
                />
              </div>
            ))}
          </div>
        </div>

        <style jsx>{`
          @keyframes scroll-smooth {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }

          @keyframes float-gentle {
            0%, 100% {
              transform: translateY(0) scale(1);
            }
            50% {
              transform: translateY(-10px) scale(1.02);
            }
          }

          .animate-scroll-smooth {
            animation: scroll-smooth 55s linear infinite;
          }

          .animate-scroll-smooth:hover,
          .animate-scroll-smooth:active {
            animation-play-state: paused;
          }

          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }

          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </section>

      {/* ===== ORGANIC WAVE DIVIDER ===== */}
      <div className="relative h-32 overflow-hidden">
        {/* SVG Wave with Tropical Leaf Pattern */}
        <svg 
          className="absolute bottom-0 w-full h-32" 
          viewBox="0 0 1440 120" 
          preserveAspectRatio="none"
          style={{ transform: "scaleY(-1)" }}
        >
          <defs>
            <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: "rgb(255, 255, 255)", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "rgb(245, 235, 220)", stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <path 
            fill="url(#waveGradient)" 
            d="M0,64 C320,100 420,20 720,64 C1020,108 1120,28 1440,64 L1440,120 L0,120 Z"
            opacity="0.8"
          />
          <path 
            fill="url(#waveGradient)" 
            d="M0,80 C360,20 580,100 960,80 C1240,64 1380,100 1440,80 L1440,120 L0,120 Z"
            opacity="0.6"
          />
        </svg>
        
        {/* Fading Tropical Leaf Accent */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <Leaf className="text-sage" size={80} style={{ transform: "rotate(-15deg)" }} />
        </div>
      </div>

      {/* ===== SECTION 2: THE COMMUNITY (BELONG) ===== */}
      <section className="relative py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-20">
            <h2 className="font-display text-5xl md:text-6xl text-charcoal mb-4">
              <span className="italic text-charcoal/70">Beyond the Mat:</span><br />
              Find Your People.
            </h2>
            <p className="font-body text-xl text-charcoal/80 max-w-3xl mx-auto leading-relaxed">
              True wellness isn't just physical. It's belonging, connection, and shared experiences 
              that remind us what it means to be fully present.
            </p>
          </div>

          {/* Event Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            
            {/* Event Card 1: Analog Club */}
            <div className="group relative">
              <div className="relative overflow-hidden rounded-3xl shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:shadow-sage/30">
                {/* Image Carousel */}
                <div className="relative h-[400px]">
                  {analogImages.map((image, index) => (
                    <div
                      key={image}
                      className="absolute inset-0 transition-opacity duration-1000"
                      style={{
                        opacity: index === analogImageIndex ? 1 : 0,
                        zIndex: index === analogImageIndex ? 1 : 0
                      }}
                    >
                      <Image
                        src={image}
                        alt="Analog Club - Unplugged Community Gathering"
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        quality={90}
                      />
                    </div>
                  ))}
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-linear-to-t from-charcoal via-charcoal/60 to-transparent z-10" />
                </div>
                
                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sage/30 backdrop-blur-xl border border-sage/40 mb-3">
                    <Users className="text-white" size={14} />
                    <span className="font-body text-xs text-white font-medium">Weekly Gathering</span>
                  </div>
                  
                  <h3 className="font-display text-2xl text-white font-semibold mb-2">
                    <span className="italic text-white/80">The</span> Analog Club
                  </h3>
                  
                  <p className="font-body text-sm text-white/90 leading-relaxed mb-4">
                    Turn back the clock, for real. Leave your phone outside and let the minutes slow down.
                  </p>
                  
                  <a
                    href="https://urbanaut.app/about-copperandcloves?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAb21jcAQ8fCFleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAadKmUR2R4J6oca_ccyAyvovQDgZa6FelOTS1v4tE-D3C3cI5invBxc1kECpfQ_aem_b549X4g_EtmAdigMamL50g"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button 
                      size="sm"
                      className="bg-white hover:bg-white/90 text-charcoal shadow-xl w-full text-sm"
                    >
                      RSVP to The Analog Club
                      <ArrowRight className="ml-2" size={16} />
                    </Button>
                  </a>
                </div>
              </div>
            </div>

            {/* Event Card 2: Sober Sundowners */}
            <div className="group relative">
              <div className="relative overflow-hidden rounded-3xl shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:shadow-terracotta/30">
                {/* Image */}
                <div className="relative h-[400px]">
                  <Image
                    src={cdnUrl("/cafe-studio.jpg")}
                    alt="Sober Sundowners - Alcohol-Free Social Gathering"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    quality={90}
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-linear-to-t from-charcoal via-charcoal/60 to-transparent" />
                </div>
                
                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-terracotta/30 backdrop-blur-xl border border-terracotta/40 mb-3">
                    <Sparkles className="text-white" size={14} />
                    <span className="font-body text-xs text-white font-medium">Weekend Vibes</span>
                  </div>
                  
                  <h3 className="font-display text-2xl text-white font-semibold mb-2">
                    <span className="italic text-white/80">Sober</span> Sundowners
                  </h3>
                  
                  <p className="font-body text-sm text-white/90 leading-relaxed mb-4">
                    A welcoming space to celebrate life without alcohol and find joy in real connections.
                  </p>
                  
                  <a
                    href="https://urbanaut.app/about-copperandcloves?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAb21jcAQ8fCFleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAadKmUR2R4J6oca_ccyAyvovQDgZa6FelOTS1v4tE-D3C3cI5invBxc1kECpfQ_aem_b549X4g_EtmAdigMamL50g"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button 
                      size="sm"
                      className="bg-white hover:bg-white/90 text-charcoal shadow-xl w-full text-sm"
                    >
                      RSVP to Sundowners
                      <ArrowRight className="ml-2" size={16} />
                    </Button>
                  </a>
                </div>
              </div>
            </div>

            {/* Event Card 3: The Reading Social */}
            <div className="group relative">
              <div className="relative overflow-hidden rounded-3xl shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:shadow-sage/30">
                {/* Image */}
                <div className="relative h-[400px]">
                  <Image
                    src={cdnUrl("/events/Reading-social.png")}
                    alt="The Reading Social - Monthly Book Club Gathering"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    quality={90}
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-linear-to-t from-charcoal via-charcoal/60 to-transparent" />
                </div>
                
                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sage/30 backdrop-blur-xl border border-sage/40 mb-3">
                    <Calendar className="text-white" size={14} />
                    <span className="font-body text-xs text-white font-medium">Monthly Haven</span>
                  </div>
                  
                  <h3 className="font-display text-2xl text-white font-semibold mb-2">
                    <span className="italic text-white/80">The</span> Reading Social
                  </h3>
                  
                  <p className="font-body text-sm text-white/90 leading-relaxed mb-4">
                    90 minutes of silent reading with coffee and breakfast, then a sharing circle.
                  </p>
                  
                  <a
                    href="https://urbanaut.app/about-copperandcloves?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAb21jcAQ8fCFleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAadKmUR2R4J6oca_ccyAyvovQDgZa6FelOTS1v4tE-D3C3cI5invBxc1kECpfQ_aem_b549X4g_EtmAdigMamL50g"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button 
                      size="sm"
                      className="bg-white hover:bg-white/90 text-charcoal shadow-xl w-full text-sm"
                    >
                      RSVP to The Reading Social
                      <ArrowRight className="ml-2" size={16} />
                    </Button>
                  </a>
                </div>
              </div>
            </div>

            {/* Event Card 4: Friday Work Deli */}
            <div className="group relative">
              <div className="relative overflow-hidden rounded-3xl shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:shadow-sage/30">
                {/* Image */}
                <div className="relative h-[400px]">
                  <Image
                    src={cdnUrl("/events/Work-Deli-1.jpeg")}
                    alt="Friday Work Deli - Co-working Community"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    quality={90}
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-linear-to-t from-charcoal via-charcoal/60 to-transparent" />
                </div>
                
                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sage/30 backdrop-blur-xl border border-sage/40 mb-3">
                    <Sparkles className="text-white" size={14} />
                    <span className="font-body text-xs text-white font-medium">Weekly Friday</span>
                  </div>
                  
                  <h3 className="font-display text-2xl text-white font-semibold mb-2">
                    Friday Work Deli
                  </h3>
                  
                  <p className="font-body text-sm text-white/90 leading-relaxed mb-4">
                    Focus, Create, Nourish. Work doesn't feel like work when you're part of the community.
                  </p>
                  
                  <a
                    href="https://urbanaut.app/about-copperandcloves?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAb21jcAQ8fCFleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAadKmUR2R4J6oca_ccyAyvovQDgZa6FelOTS1v4tE-D3C3cI5invBxc1kECpfQ_aem_b549X4g_EtmAdigMamL50g"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button 
                      size="sm"
                      className="bg-white hover:bg-white/90 text-charcoal shadow-xl w-full text-sm"
                    >
                      RSVP to Friday Work Deli
                      <ArrowRight className="ml-2" size={16} />
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Community Calendar CTA */}
          <div className="mt-20 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-sage/10 backdrop-blur-xl border border-sage/20 mb-6">
              <Calendar className="text-sage" size={20} />
              <span className="font-body text-charcoal">New events added monthly</span>
            </div>
            
            <h3 className="font-display text-3xl text-charcoal mb-4">
              Never Miss a Moment
            </h3>
            <p className="font-body text-charcoal/80 mb-8 max-w-2xl mx-auto">
              Join the WhatsApp Community to stay updated on all upcoming events, workshops, and gatherings.
            </p>
            
            <a
              href="https://chat.whatsapp.com/CAyYCFIKqJX1g6pUOjfPYW?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAb21jcAQ8U75leHRuA2FlbQIxMQBzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAaf_Ir-MGzqoJbp1XiKxsstXupmej8How2XcRmSYke70rdbJIhsewCX1IOaIJQ_aem_Opa_8N-PocOjlfkmvaeqXg"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button 
                size="lg"
                variant="outline"
                className="border-2 border-sage/40 hover:bg-sage/5 text-charcoal px-10 py-6 text-base rounded-full"
              >
                Join WhatsApp Community
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative py-24 px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-sage/20 to-terracotta/20" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="font-display text-4xl md:text-5xl text-charcoal mb-6">
            Your Sanctuary Awaits
          </h2>
          <p className="font-body text-xl text-charcoal/80 mb-10 leading-relaxed">
            Move your body. Nourish your soul. Find your people.<br />
            All under one roof.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              className="bg-sage text-white hover:bg-sage/90 px-10 py-6 text-base rounded-full shadow-2xl"
            >
              Book Your First Class
            </Button>
            <Link href="/cafe/meal-subscription">
              <Button 
                size="lg"
                variant="outline"
                className="border-2 border-sage/40 hover:bg-sage/5 text-charcoal px-10 py-6 text-base rounded-full"
              >
                Subscribe to Intentful Eating
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}