import { SEO } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function FounderPage() {
  return (
    <>
      <SEO 
        title="Meet the Founder | The Studio by Copper + Cloves"
        description="Learn about the founder's journey from London to Bangalore and the story behind Copper + Cloves."
      />
      
      <Navigation />

      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-linear-to-br from-cream via-white to-sage/5" />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <Link href="/">
            <Button 
              variant="outline"
              className="mb-8 border-sage/30 hover:bg-sage/5 text-charcoal"
            >
              <ArrowLeft className="mr-2" size={20} />
              Back to Home
            </Button>
          </Link>

          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage/10 border border-sage/20 mb-6">
              <Heart className="text-terracotta" size={16} />
              <span className="font-body text-xs text-charcoal font-medium tracking-wide">THE STORY BEHIND C+C</span>
            </div>
            
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-charcoal mb-6">
              Meet the Founder
            </h1>
            
            <p className="font-body text-xl text-charcoal/70 max-w-2xl mx-auto leading-relaxed">
              The heart and soul behind Copper + Cloves
            </p>
          </div>
        </div>
      </section>

      {/* Founder Story Section */}
      <section className="relative py-16 px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Left: Photo */}
            <div className="relative">
              {/* Main Photo */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <Image
                  src="/founder.jpg"
                  alt="Founder of Copper + Cloves"
                  width={600}
                  height={750}
                  className="w-full h-auto object-cover"
                  quality={95}
                  priority
                />
                {/* Subtle Overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-charcoal/10 to-transparent" />
              </div>

              {/* Decorative Background Element */}
              <div className="absolute -bottom-6 -right-6 w-full h-full rounded-3xl bg-linear-to-br from-sage/20 to-terracotta/20 -z-10" />
            </div>

            {/* Right: Story */}
            <div className="space-y-8">
              {/* Story Paragraphs */}
              <div className="space-y-6">
                <p className="font-body text-lg text-charcoal/80 leading-relaxed">
                  I started Copper + Cloves in 2018 to share my new found love of healthy, plant-based eating. I was early on in my plant-based journey and I was relatively new to Bangalore (I moved here from London in 2016). I never expected to feel such a surge in my health after giving up meat and my intent was to share my food— colourful, vibrant and delicious— while bringing people together and building a community around living well.
                </p>

                <p className="font-body text-lg text-charcoal/80 leading-relaxed">
                  Copper + Cloves has grown from monthly events and cooking workshops, to opening the first Copper + Cloves in 2020, going on to opening a second and third outlet, and launching our meal subscription service in Bangalore from our delivery kitchen! What started with me making and selling granola in my home kitchen has grown to a multi-outlet operation with a team of 20+. We have a beautiful, thriving community and we host weekly events to support connection in the city.
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 pt-8">
                <div className="text-center p-6 rounded-2xl bg-white/60 backdrop-blur-xs border border-sage/10">
                  <p className="font-display text-3xl text-sage mb-1">2018</p>
                  <p className="font-body text-xs text-charcoal/70">Founded</p>
                </div>
                <div className="text-center p-6 rounded-2xl bg-white/60 backdrop-blur-xs border border-sage/10">
                  <p className="font-display text-3xl text-sage mb-1">3</p>
                  <p className="font-body text-xs text-charcoal/70">Locations</p>
                </div>
                <div className="text-center p-6 rounded-2xl bg-white/60 backdrop-blur-xs border border-sage/10">
                  <p className="font-display text-3xl text-sage mb-1">20+</p>
                  <p className="font-body text-xs text-charcoal/70">Team Members</p>
                </div>
              </div>

              {/* Quote Card */}
              <div className="relative p-8 rounded-3xl bg-linear-to-br from-sage/10 to-cream border border-sage/20 mt-8">
                <div className="absolute top-6 left-6 w-12 h-12 rounded-full bg-terracotta/10 flex items-center justify-center">
                  <Heart className="text-terracotta" size={24} />
                </div>
                <p className="font-body text-lg text-charcoal/80 leading-relaxed italic pl-16">
                  "From home kitchen to multi-outlet wellness sanctuary — the journey has been about community, connection, and conscious living."
                </p>
              </div>

              {/* CTA */}
              <div className="pt-8">
                <Link href="/">
                  <Button 
                    size="lg"
                    className="bg-sage hover:bg-sage/90 text-white px-10 py-6 text-base rounded-full shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto"
                  >
                    Explore The Studio
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Journey Timeline */}
      <section className="relative py-20 px-6 lg:px-8 bg-linear-to-b from-transparent to-cream/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-4xl md:text-5xl text-charcoal text-center mb-16">
            The Journey
          </h2>

          <div className="space-y-8">
            {/* Timeline Item 1 */}
            <div className="flex gap-6 items-start">
              <div className="shrink-0 w-24 text-right">
                <p className="font-display text-2xl text-sage">2016</p>
              </div>
              <div className="shrink-0 w-px h-full bg-sage/20" />
              <div className="flex-1 pb-8">
                <p className="font-body text-charcoal/80 leading-relaxed">
                  Moved from London to Bangalore, beginning a new chapter and discovering plant-based living.
                </p>
              </div>
            </div>

            {/* Timeline Item 2 */}
            <div className="flex gap-6 items-start">
              <div className="shrink-0 w-24 text-right">
                <p className="font-display text-2xl text-sage">2018</p>
              </div>
              <div className="shrink-0 w-px h-full bg-sage/20" />
              <div className="flex-1 pb-8">
                <p className="font-body text-charcoal/80 leading-relaxed">
                  Founded Copper + Cloves — started with granola in a home kitchen, hosting monthly events and cooking workshops.
                </p>
              </div>
            </div>

            {/* Timeline Item 3 */}
            <div className="flex gap-6 items-start">
              <div className="shrink-0 w-24 text-right">
                <p className="font-display text-2xl text-sage">2020</p>
              </div>
              <div className="shrink-0 w-px h-full bg-sage/20" />
              <div className="flex-1 pb-8">
                <p className="font-body text-charcoal/80 leading-relaxed">
                  Opened the first Copper + Cloves outlet, creating a physical space for the community.
                </p>
              </div>
            </div>

            {/* Timeline Item 4 */}
            <div className="flex gap-6 items-start">
              <div className="shrink-0 w-24 text-right">
                <p className="font-display text-2xl text-sage">2024</p>
              </div>
              <div className="shrink-0 w-px h-full bg-sage/20" />
              <div className="flex-1">
                <p className="font-body text-charcoal/80 leading-relaxed">
                  Expanded to three locations, launched meal subscription service, and grew to a team of 20+ with a thriving community hosting weekly events.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}