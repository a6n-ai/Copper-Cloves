import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { SEO as Seo } from "@/components/SEO";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Leaf,
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


const sanctuaryFeatures = [
  { icon: Wifi, title: "Fast Wi-Fi", desc: "High-speed connectivity for those who need reliable internet to focus." },
  { icon: Zap, title: "Power & Comfort", desc: "Plentiful charging points and ergonomic seating amidst tropical greenery." },
  { icon: Volume2, title: "Quiet Zones", desc: "A retreat from the city bustle, designed for deep focus and calm." },
];

export default function CafePage() {
  const [analogImageIndex, setAnalogImageIndex] = useState(0);
  const [heroMediaIndex, setHeroMediaIndex] = useState(0);

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
      image: cdnUrl("/food/A7403685.jpg")
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
      image: cdnUrl("/food/DSC05959.jpg")
    }
  ];

  return (
    <>
      <Seo
        title="Café & Community | The Studio by Copper + Cloves"
        description="Nourish your body with plant-based meals and belong to a vibrant community. Join us for The Analog Club and Sober Sundowners."
      />

      {/* Cream base matches the home page; sections layer their own warmth on top. */}

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
            {heroMedia.map((media, index) => {
              const isVisible = index === heroMediaIndex;

              let leftEl = null;
              if (isVisible && media.type === "video") {
                leftEl = (
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="none"
                    className="w-full h-full animate-subtle-float"
                    style={{
                      objectFit: 'cover',
                      objectPosition: 'center center',
                      filter: 'contrast(1.1) saturate(1.15)'
                    }}
                  >
                    <source src={media.src} type="video/mp4" />
                  </video>
                );
              } else if (isVisible && media.type === "image") {
                leftEl = (
                  <Image
                    src={media.src}
                    alt=""
                    aria-hidden="true"
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
                );
              }

              return (
                <div
                  key={`left-${media.src}`}
                  className="absolute inset-0 transition-opacity duration-[2000ms]"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    zIndex: isVisible ? 1 : 0
                  }}
                >
                  {leftEl}
                </div>
              );
            })}
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

              let rightEl = null;
              if (isVisible && rightMedia.type === "video") {
                rightEl = (
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="none"
                    className="w-full h-full animate-subtle-float-reverse"
                    style={{
                      objectFit: 'cover',
                      objectPosition: 'center center',
                      filter: 'contrast(1.1) saturate(1.15)'
                    }}
                  >
                    <source src={rightMedia.src} type="video/mp4" />
                  </video>
                );
              } else if (isVisible && rightMedia.type === "image") {
                rightEl = (
                  <Image
                    src={rightMedia.src}
                    alt=""
                    aria-hidden="true"
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
                );
              }

              return (
                <div
                  key={`right-${media.src}`}
                  className="absolute inset-0 transition-opacity duration-[2000ms]"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    zIndex: isVisible ? 1 : 0
                  }}
                >
                  {rightEl}
                </div>
              );
            })}
          </div>

          {/* Gradient Overlay for Text Readability */}
          <div className="absolute inset-0 bg-linear-to-r from-charcoal/80 via-charcoal/60 to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative z-20 max-w-7xl mx-auto px-6 lg:px-8 py-16 md:py-20">
          {/* Badge - Far Left */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage/30 border border-sage/40">
              <Leaf className="text-sage" size={14} />
              <span className="font-body text-xs text-cream font-semibold tracking-wide">100% PLANT-BASED DAILY RITUAL</span>
            </div>
          </div>

          {/* Centered Content */}
          <div className="max-w-4xl mx-auto text-center">
            {/* Main Headline */}
            <h1 className="font-display text-6xl md:text-7xl lg:text-8xl text-cream leading-[1.05] mb-8">
              <span className="italic text-cream/90">Nourishment for the</span><br />
              Soul, Fuel for the Body.
            </h1>

            {/* Subheadline */}
            <p className="font-body text-2xl md:text-3xl text-cream/95 leading-relaxed mb-6 max-w-3xl mx-auto font-light">
              Your wellness journey continues beyond the mat. Refuel with chef-crafted, plant-based meals.
            </p>

            <p className="font-body text-xl text-cream/85 leading-relaxed mb-12 max-w-2xl mx-auto">
              Meals that restore, energize, and nourish from the inside out.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="sage" className="w-full sm:w-auto">
                <Link href="/cafe/meal-subscription">
                  Explore the Menu
                  <ArrowRight className="ml-2" size={20} />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-2 border-cream/40 hover:bg-white-warm/10 text-cream hover:text-cream"
              >
                <a
                  href="https://www.google.com/maps/search/?api=1&query=The+Studio+by+Copper+and+Cloves"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin className="mr-2" size={20} />
                  Find Our Location
                </a>
              </Button>
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

          @media (prefers-reduced-motion: reduce) {
            .animate-subtle-float,
            .animate-subtle-float-reverse {
              animation: none;
            }
          }
        `}</style>
      </section>

      {/* Open Invitation Section - Public Welcome (co-working pitch + features) */}
      <section className="relative py-14 md:py-20 px-6 lg:px-8 overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute inset-0 bg-linear-to-br from-sage/5 via-cream to-white-warm -z-10" />
        
        <div className="max-w-7xl mx-auto">
          <div className="grid items-stretch gap-10 lg:grid-cols-2 lg:gap-14">
            {/* Left: Content + integrated feature list */}
            <div className="flex flex-col">
              <span className="font-body text-xs font-semibold tracking-[0.18em] uppercase text-terracotta">
                Open To All
              </span>

              <h2 className="mt-3 mb-6 font-display text-4xl leading-tight text-charcoal md:text-5xl lg:text-6xl">
                A Sanctuary for Your Best Work.
              </h2>

              <p className="mb-8 max-w-prose font-body text-lg leading-relaxed text-charcoal/80">
                No membership? No problem. Our doors are open to everyone, whether you're here for a post-class refuel or looking for a sun-drenched space to focus. With high-speed Wi-Fi, premium coffee, and a lush rooftop vibe, consider this your home away from home for the day.
              </p>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Button asChild size="lg" variant="sage" className="w-full sm:w-auto">
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=The+Studio+by+Copper+and+Cloves"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="mr-2" size={20} />
                    Find Our Location
                  </a>
                </Button>
                <Button asChild size="lg" variant="sage-outline" className="w-full sm:w-auto">
                  <Link href="/cafe/meal-subscription">View Full Menu</Link>
                </Button>
              </div>

              {/* Feature list — stacked editorial rows, not a card grid */}
              <div className="mt-10 space-y-5 border-t border-sage/15 pt-8">
                {sanctuaryFeatures.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.title} className="flex items-start gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sage/10 text-sage">
                        <Icon size={22} />
                      </div>
                      <div>
                        <h3 className="font-display text-xl text-charcoal">{f.title}</h3>
                        <p className="font-body text-sm leading-relaxed text-charcoal/70">{f.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Lifestyle image, fills the column height */}
            <div className="relative">
              <div className="relative h-full min-h-[420px] overflow-hidden rounded-3xl shadow-[0_8px_48px_rgba(51,51,51,0.14)]">
                <Image
                  src={cdnUrl("/coworking.jpg")}
                  alt="Co-working at The Studio: laptop, coffee, and community on the rooftop"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  quality={90}
                />
                <div className="absolute inset-0 bg-linear-to-t from-charcoal/25 to-transparent" />
              </div>

              {/* Floating stat panel — solid white-warm, soft lifted shadow */}
              <div className="absolute -bottom-6 -right-6 rounded-2xl border border-sage/10 bg-white-warm p-6 shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-full bg-sage/10">
                    <Wifi className="text-sage" size={28} />
                  </div>
                  <div>
                    <p className="font-display text-2xl text-charcoal">High-Speed</p>
                    <p className="font-body text-sm text-charcoal/60">Wi-Fi &amp; Power</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Digital Menu - Glassmorphism Cards */}
      <section className="relative pt-12 md:pt-16 pb-20 md:pb-28 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <span className="font-body text-xs font-semibold tracking-[0.18em] uppercase text-terracotta">
              Café &amp; Kitchen
            </span>
            <h2 className="font-display text-4xl md:text-5xl text-charcoal mt-3 mb-4">
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
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {menuCategories.map((category, i) => {
              const Icon = category.icon;
              return (
                <div
                  key={category.title}
                  style={{ animationDelay: `${i * 90}ms` }}
                  className="group relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-2xl border border-border bg-charcoal shadow-none transition-all duration-500 fade-in-0 slide-in-from-bottom-4 fill-mode-both animate-in motion-reduce:animate-none hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(51,51,51,0.16)]"
                >
                  <Image
                    src={category.image}
                    alt={category.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
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

        </div>
      </section>

      {/* ===== NOURISH GALLERY — community marquee with section header ===== */}
      <section className="relative w-full bg-white-warm overflow-hidden py-20 md:py-28">
        {/* Section header — left-aligned, asymmetric. Terracotta leads (food/community context). */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8 mb-12">
          <span className="font-body text-xs font-semibold tracking-[0.18em] uppercase text-terracotta">
            Gather · The Table
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-charcoal leading-tight mt-3 mb-5 max-w-2xl">
            Where strangers <span className="italic text-charcoal/70">become regulars.</span>
          </h2>
          <p className="font-body text-lg text-charcoal/70 leading-relaxed max-w-xl">
            Real food, real faces, shared at our communal table every day.
          </p>
        </div>

        <div className="relative z-10 overflow-x-auto overflow-y-hidden scrollbar-hide">
          <div className="flex gap-6 md:gap-8 px-6 md:px-10 w-max max-w-none animate-scroll-smooth">
            {[...galleryImages, ...galleryImages].map((image, index) => (
              <div
                key={`${image}-${index}`}
                className="group relative shrink-0 w-[260px] h-[320px] sm:w-[280px] sm:h-[350px] md:w-[300px] md:h-[380px] rounded-2xl md:rounded-3xl overflow-hidden border border-border transition-[transform,box-shadow] duration-500 hover:scale-[1.02] hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]"
              >
                <Image
                  src={image}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 280px, 300px"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
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

          .animate-scroll-smooth {
            animation: scroll-smooth 55s linear infinite;
          }

          .animate-scroll-smooth:hover,
          .animate-scroll-smooth:active {
            animation-play-state: paused;
          }

          @media (prefers-reduced-motion: reduce) {
            .animate-scroll-smooth {
              animation: none;
            }
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
      <div className="relative h-16 overflow-hidden">
        {/* SVG Wave with Tropical Leaf Pattern */}
        <svg
          className="absolute bottom-0 w-full h-16"
          viewBox="0 0 1440 120" 
          preserveAspectRatio="none"
          style={{ transform: "scaleY(-1)" }}
        >
          <defs>
            <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: "rgb(250, 250, 248)", stopOpacity: 1 }} />
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
      </div>

      {/* ===== SECTION 2: THE COMMUNITY (BELONG) ===== */}
      <section className="relative pt-2 md:pt-4 pb-20 md:pb-28 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-10">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-sage/10">
              <Leaf className="text-sage" size={26} style={{ transform: "rotate(-12deg)" }} />
            </div>
            <span className="font-body text-xs font-semibold tracking-[0.18em] uppercase text-terracotta">
              The Community
            </span>
            <h2 className="font-display text-5xl md:text-6xl text-charcoal mt-3 mb-4">
              <span className="italic text-charcoal/70">Beyond the Mat:</span><br />
              Find Your People.
            </h2>
            <p className="mx-auto max-w-2xl font-body text-lg md:text-xl text-charcoal/80 leading-relaxed">
              True wellness isn't just physical. It's belonging, connection, and shared
              experiences that remind us what it means to be fully present.
            </p>
          </div>

          {/* Event Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            
            {/* Event Card 1: Analog Club */}
            <div className="group relative">
              <div className="relative overflow-hidden rounded-3xl border border-border transition-[transform,box-shadow] duration-500 hover:scale-[1.02] hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
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
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sage/30 border border-sage/40 mb-3">
                    <Users className="text-cream" size={14} />
                    <span className="font-body text-xs text-cream font-medium">Weekly Gathering</span>
                  </div>
                  
                  <h3 className="font-display text-2xl text-cream font-semibold mb-2">
                    <span className="italic text-cream/80">The</span> Analog Club
                  </h3>
                  
                  <p className="font-body text-sm text-cream/90 leading-relaxed mb-4">
                    Turn back the clock, for real. Leave your phone outside and let the minutes slow down.
                  </p>
                  
                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                    className="w-full bg-white-warm hover:bg-cream text-charcoal"
                  >
                    <a
                      href="https://urbanaut.app/about-copperandcloves?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAb21jcAQ8fCFleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAadKmUR2R4J6oca_ccyAyvovQDgZa6FelOTS1v4tE-D3C3cI5invBxc1kECpfQ_aem_b549X4g_EtmAdigMamL50g"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      RSVP to The Analog Club
                      <ArrowRight className="ml-2" size={16} />
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            {/* Event Card 2: Sober Sundowners */}
            <div className="group relative">
              <div className="relative overflow-hidden rounded-3xl border border-border transition-[transform,box-shadow] duration-500 hover:scale-[1.02] hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
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
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-terracotta/30 border border-terracotta/40 mb-3">
                    <Sparkles className="text-cream" size={14} />
                    <span className="font-body text-xs text-cream font-medium">Weekend Vibes</span>
                  </div>
                  
                  <h3 className="font-display text-2xl text-cream font-semibold mb-2">
                    <span className="italic text-cream/80">Sober</span> Sundowners
                  </h3>
                  
                  <p className="font-body text-sm text-cream/90 leading-relaxed mb-4">
                    A welcoming space to celebrate life without alcohol and find joy in real connections.
                  </p>
                  
                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                    className="w-full bg-white-warm hover:bg-cream text-charcoal"
                  >
                    <a
                      href="https://urbanaut.app/about-copperandcloves?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAb21jcAQ8fCFleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAadKmUR2R4J6oca_ccyAyvovQDgZa6FelOTS1v4tE-D3C3cI5invBxc1kECpfQ_aem_b549X4g_EtmAdigMamL50g"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      RSVP to Sundowners
                      <ArrowRight className="ml-2" size={16} />
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            {/* Event Card 3: The Reading Social */}
            <div className="group relative">
              <div className="relative overflow-hidden rounded-3xl border border-border transition-[transform,box-shadow] duration-500 hover:scale-[1.02] hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
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
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sage/30 border border-sage/40 mb-3">
                    <Calendar className="text-cream" size={14} />
                    <span className="font-body text-xs text-cream font-medium">Monthly Haven</span>
                  </div>
                  
                  <h3 className="font-display text-2xl text-cream font-semibold mb-2">
                    <span className="italic text-cream/80">The</span> Reading Social
                  </h3>
                  
                  <p className="font-body text-sm text-cream/90 leading-relaxed mb-4">
                    90 minutes of silent reading with coffee and breakfast, then a sharing circle.
                  </p>
                  
                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                    className="w-full bg-white-warm hover:bg-cream text-charcoal"
                  >
                    <a
                      href="https://urbanaut.app/about-copperandcloves?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAb21jcAQ8fCFleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAadKmUR2R4J6oca_ccyAyvovQDgZa6FelOTS1v4tE-D3C3cI5invBxc1kECpfQ_aem_b549X4g_EtmAdigMamL50g"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      RSVP to The Reading Social
                      <ArrowRight className="ml-2" size={16} />
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            {/* Event Card 4: Friday Work Deli */}
            <div className="group relative">
              <div className="relative overflow-hidden rounded-3xl border border-border transition-[transform,box-shadow] duration-500 hover:scale-[1.02] hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
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
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sage/30 border border-sage/40 mb-3">
                    <Sparkles className="text-cream" size={14} />
                    <span className="font-body text-xs text-cream font-medium">Weekly Friday</span>
                  </div>
                  
                  <h3 className="font-display text-2xl text-cream font-semibold mb-2">
                    Friday Work Deli
                  </h3>
                  
                  <p className="font-body text-sm text-cream/90 leading-relaxed mb-4">
                    Focus, Create, Nourish. Work doesn't feel like work when you're part of the community.
                  </p>
                  
                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                    className="w-full bg-white-warm hover:bg-cream text-charcoal"
                  >
                    <a
                      href="https://urbanaut.app/about-copperandcloves?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAb21jcAQ8fCFleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAadKmUR2R4J6oca_ccyAyvovQDgZa6FelOTS1v4tE-D3C3cI5invBxc1kECpfQ_aem_b549X4g_EtmAdigMamL50g"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      RSVP to Friday Work Deli
                      <ArrowRight className="ml-2" size={16} />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Community Calendar CTA */}
          <div className="mt-16 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-sage/10 border border-sage/20 mb-6">
              <Calendar className="text-sage" size={20} />
              <span className="font-body text-charcoal">New events added monthly</span>
            </div>
            
            <h3 className="font-display text-3xl text-charcoal mb-4">
              Never Miss a Moment
            </h3>
            <p className="font-body text-charcoal/80 mb-8 max-w-2xl mx-auto">
              Join the WhatsApp Community to stay updated on all upcoming events, workshops, and gatherings.
            </p>
            
            <Button asChild size="lg" variant="sage-outline">
              <a
                href="https://chat.whatsapp.com/CAyYCFIKqJX1g6pUOjfPYW?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAb21jcAQ8U75leHRuA2FlbQIxMQBzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAaf_Ir-MGzqoJbp1XiKxsstXupmej8How2XcRmSYke70rdbJIhsewCX1IOaIJQ_aem_Opa_8N-PocOjlfkmvaeqXg"
                target="_blank"
                rel="noopener noreferrer"
              >
                Join WhatsApp Community
              </a>
            </Button>
          </div>
        </div>
      </section>

      <Footer
        cta={{
          kicker: "The Studio by Copper + Cloves",
          heading: "Your Sanctuary Awaits",
          body: [
            "Move your body. Nourish your soul. Find your people. All under one roof.",
            "And when you need to refuel, guarantee yourself chef-prepared, plant-based meals every day with our Studio Meal Subscription. Wellness, made effortless.",
          ],
          primary: { label: "Book Your First Class", href: "/classes" },
          secondary: {
            label: "Subscribe to Intentful Eating",
            href: "/cafe/meal-subscription",
          },
          note: (
            <>
              Not sure what your body needs?{" "}
              <Link
                href="/cafe/meal-subscription"
                className="font-semibold text-white-warm underline underline-offset-2 transition-colors hover:text-cream"
              >
                Connect with our in-house nutritionist
              </Link>{" "}
              for personalized guidance.
            </>
          ),
        }}
      />
    </>
  );
}