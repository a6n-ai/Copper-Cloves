import dynamic from "next/dynamic";
import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { Experience } from "@/components/Experience";
import { ClassCatalog } from "@/components/ClassCatalog";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";

import { cdnUrl } from "@/lib/cdnUrl";

// Below-the-fold sections — load on demand so the landing bundle stays focused
// on the above-the-fold Hero + ClassCatalog. SSR kept on so SEO crawlers still
// see the full content (only the JS download is deferred).
const Instructors = dynamic(() => import("@/components/Instructors").then((m) => ({ default: m.Instructors })));
const Pricing = dynamic(() => import("@/components/Pricing").then((m) => ({ default: m.Pricing })));
const Founder = dynamic(() => import("@/components/Founder").then((m) => ({ default: m.Founder })));
const Rental = dynamic(() => import("@/components/Rental").then((m) => ({ default: m.Rental })));
const Boutique = dynamic(() => import("@/components/Boutique").then((m) => ({ default: m.Boutique })));
const Testimonial = dynamic(() => import("@/components/Testimonial").then((m) => ({ default: m.Testimonial })));

export default function Home() {
  return (
    <>
      <SEO
        title="The Studio by Copper + Cloves | Your Home Away From Home"
        description="Move your body, refuel with a café bowl, and find your community. Expert-led wellness classes, plant-based café, and a sanctuary in the city."
        image={cdnUrl("/og-image.png")}
      />
      <div className="min-h-screen bg-cream">
        <Navigation variant="overlay" />
        <Hero />
        <Experience />
        <ClassCatalog />
        <Instructors />
        <Testimonial />
        <Pricing />
        <Founder />
        <Rental />
        <Boutique />
        <Footer />
      </div>
    </>
  );
}