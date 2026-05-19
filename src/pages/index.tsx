import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { Experience } from "@/components/Experience";
import { ClassCatalog } from "@/components/ClassCatalog";
import { Instructors } from "@/components/Instructors";
import { Pricing } from "@/components/Pricing";
import { Founder } from "@/components/Founder";
import { Rental } from "@/components/Rental";
import { Boutique } from "@/components/Boutique";
import { Testimonial } from "@/components/Testimonial";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";

import { cdnUrl } from "@/lib/cdnUrl";
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