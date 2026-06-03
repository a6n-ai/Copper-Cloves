import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { 
  Heart, 
  Check, 
  Calendar,
  User,
  Mail,
  Phone,
  MessageSquare,
  Sparkles,
  ChefHat,
  Leaf
} from "lucide-react";

import { cdnUrl } from "@/lib/cdnUrl";
import { toast } from "sonner";

const heroImages = [
  cdnUrl("/meal-sub-1.jpg"),
  cdnUrl("/meal-sub-2.jpg"),
  cdnUrl("/meal-sub-3.jpg"),
  cdnUrl("/meal-sub-4.jpg")
];

export default function MealSubscriptionPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/meal-subscription-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          message: formData.message,
        }),
      });
      const data = res.ok ? await res.json().catch(() => ({})) : null;
      if (!res.ok) {
        const msg =
          typeof (data as { error?: string } | null)?.error === "string"
            ? (data as { error: string }).error
            : "Something went wrong. Please try again.";
        toast.error(msg);
        return;
      }
      setIsSuccess(true);
      setFormData({ fullName: "", email: "", phone: "", message: "" });
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <>
      <SEO 
        title="Intentful Eating - Daily Meal Subscription | The Studio by Copper + Cloves"
        description="Make wellness effortless with our chef-prepared, plant-based meal subscription. One nourishing meal delivered to you daily."
      />
      
      <Navigation />

      <div className="min-h-screen bg-white-warm">
        {/* Stunning Hero Section with Rotating Images */}
        <section className="relative min-h-screen flex items-center overflow-hidden">
          {/* Rotating Background Images */}
          <div className="absolute inset-0 z-0">
            {heroImages.map((image, index) => (
              <div
                key={image}
                className="absolute inset-0 transition-opacity duration-2000"
                style={{
                  opacity: index === currentImageIndex ? 1 : 0,
                  zIndex: index === currentImageIndex ? 1 : 0
                }}
              >
                <Image
                  src={image}
                  alt="Plant-based nourishment"
                  fill
                  sizes="100vw"
                  className="object-cover"
                  style={{ filter: 'contrast(1.15) saturate(1.2)' }}
                  quality={95}
                  priority={index === 0}
                />
              </div>
            ))}
            
            {/* Gradient Overlays for Text Readability */}
            <div className="absolute inset-0 bg-linear-to-b from-charcoal/70 via-charcoal/50 to-charcoal/80 z-10" />
            <div className="absolute inset-0 bg-linear-to-r from-charcoal/60 via-transparent to-charcoal/60 z-10" />
          </div>

          {/* Hero Content */}
          <div className="relative z-20 max-w-7xl mx-auto px-6 lg:px-8 py-32">
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
                <span className="italic text-cream/90">Subscribe to</span><br />
                Intentful Eating
              </h1>

              {/* Subheadline */}
              <p className="font-body text-2xl md:text-3xl text-cream/95 leading-relaxed mb-6 max-w-3xl mx-auto font-light">
                One chef-crafted, plant-based meal delivered to you daily.
              </p>

              <p className="font-body text-xl text-cream/85 leading-relaxed mb-12 max-w-2xl mx-auto">
                Make wellness effortless. No meal prep, no decisions—just nourishment that restores, energizes, and fuels your practice.
              </p>

              {/* CTA */}
              <Button
                size="lg"
                variant="sage"
                className="px-12 py-7 text-lg rounded-md shadow-lg shadow-charcoal/20"
                onClick={() => document.getElementById('waitlist-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                Join the Waitlist
                <Heart className="ml-3" size={20} />
              </Button>
            </div>
          </div>

          {/* Image Counter Dots */}
          <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 z-30 flex gap-3">
            {heroImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentImageIndex 
                    ? 'bg-white-warm w-8' 
                    : 'bg-[#fafaf8]/40 hover:bg-[#fafaf8]/60'
                }`}
                aria-label={`View image ${index + 1}`}
              />
            ))}
          </div>
        </section>

        {/* The Promise Section */}
        <section className="py-24 px-6 lg:px-8 bg-cream">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="font-display text-5xl md:text-6xl text-charcoal mb-8">
              <span className="italic text-charcoal/60">The</span> Promise
            </h2>
            <p className="font-body text-2xl text-charcoal/80 leading-relaxed mb-6">
              Struggling to eat clean? Tired of meal planning, prepping, and the constant mental load of "what's for dinner?"
            </p>
            <p className="font-body text-2xl text-charcoal/80 leading-relaxed font-semibold">
              Guarantee yourself one chef-prepared, plant-based meal every single day.
            </p>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-24 px-6 lg:px-8 bg-white-warm">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="font-display text-5xl md:text-6xl text-charcoal mb-6">
                <span className="italic text-charcoal/60">How It</span> Works
              </h2>
              <p className="font-body text-xl text-charcoal/70 max-w-3xl mx-auto">
                Wellness made simple. No apps, no ordering, no stress—just show up and eat.
              </p>
            </div>

            {/* Steps Grid */}
            <div className="grid md:grid-cols-3 gap-12">
              {/* Step 1 */}
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-sage/20 flex items-center justify-center mx-auto mb-6">
                  <ChefHat className="text-sage" size={36} />
                </div>
                <h3 className="font-display text-3xl text-charcoal font-semibold mb-4">
                  We Cook
                </h3>
                <p className="font-body text-lg text-charcoal/70 leading-relaxed">
                  Our chefs craft a fresh, nutritionally balanced, plant-based meal every morning using seasonal, locally sourced ingredients.
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-sage/20 flex items-center justify-center mx-auto mb-6">
                  <Calendar className="text-sage" size={36} />
                </div>
                <h3 className="font-display text-3xl text-charcoal font-semibold mb-4">
                  You Choose
                </h3>
                <p className="font-body text-lg text-charcoal/70 leading-relaxed">
                  Select your preferred meal time—breakfast, lunch, or dinner. Adjust or pause your subscription anytime with ease.
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-sage/20 flex items-center justify-center mx-auto mb-6">
                  <Heart className="text-sage" size={36} />
                </div>
                <h3 className="font-display text-3xl text-charcoal font-semibold mb-4">
                  You Eat
                </h3>
                <p className="font-body text-lg text-charcoal/70 leading-relaxed">
                  Pick up your meal at the café or have it delivered. No meal prep, no cleanup, no stress—just pure nourishment.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What You Get Section */}
        <section className="py-24 px-6 lg:px-8 bg-linear-to-br from-sage/10 via-cream to-terracotta/10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="font-display text-5xl md:text-6xl text-charcoal mb-6">
                <span className="italic text-charcoal/60">What You</span> Get
              </h2>
              <p className="font-body text-xl text-charcoal/70 max-w-2xl mx-auto">
                Every meal is designed to fuel your body, support your practice, and make clean eating effortless.
              </p>
            </div>

            {/* Benefits Grid */}
            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  icon: <Leaf />,
                  title: "100% Plant-Based",
                  description: "Whole-food, nutrient-dense meals crafted without animal products, dairy, or refined sugars."
                },
                {
                  icon: <ChefHat />,
                  title: "Chef-Prepared Daily",
                  description: "Fresh meals made from scratch every morning—never frozen, never reheated, always vibrant."
                },
                {
                  icon: <Calendar />,
                  title: "Rotating Menu",
                  description: "Seasonal variety means you'll never eat the same meal twice in a row. Always fresh, always exciting."
                },
                {
                  icon: <Heart />,
                  title: "Macro-Balanced",
                  description: "Each meal is designed to support your energy, recovery, and overall wellness goals."
                },
                {
                  icon: <Sparkles />,
                  title: "Locally Sourced",
                  description: "We partner with local farms and suppliers to bring you the freshest seasonal ingredients."
                },
                {
                  icon: <Check />,
                  title: "Flexible & Convenient",
                  description: "Pickup at the café or opt for delivery. Pause, skip, or adjust your subscription anytime."
                }
              ].map((benefit, index) => (
                <Card key={index} className="border-2 border-sage/30 hover:border-sage transition-all duration-300 hover:shadow-xl bg-white-warm">
                  <CardContent className="p-8">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full bg-sage/20 flex items-center justify-center shrink-0">
                        <div className="text-sage">{benefit.icon}</div>
                      </div>
                      <div>
                        <h3 className="font-display text-2xl text-charcoal font-semibold mb-3">
                          {benefit.title}
                        </h3>
                        <p className="font-body text-charcoal/70 leading-relaxed">
                          {benefit.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Why Subscribe + Join Waitlist - Side by Side */}
        <section className="py-24 px-6 lg:px-8 bg-white-warm">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16">
              
              {/* Left: Why Subscribe */}
              <div>
                <div className="mb-12">
                  <h2 className="font-display text-4xl text-charcoal mb-6">
                    <span className="italic text-charcoal/60">Why</span> Subscribe?
                  </h2>
                </div>

                <div className="space-y-8">
                  <Card className="border-2 border-sage/20 bg-linear-to-br from-sage/5 to-[#fafaf8]">
                    <CardContent className="p-10">
                      <h3 className="font-display text-3xl text-charcoal font-semibold mb-4">
                        Because clean eating shouldn't be hard.
                      </h3>
                      <p className="font-body text-lg text-charcoal/80 leading-relaxed mb-6">
                        You know you need to eat better. You know whole foods matter. But between work, training, and life—who has the time to meal prep?
                      </p>
                      <p className="font-body text-lg text-charcoal/80 leading-relaxed">
                        With our daily meal subscription, you remove the guesswork, the grocery runs, the chopping, the cooking, and the cleanup. One less decision. One more reason to show up for yourself.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-sage/20 bg-linear-to-br from-sage/5 to-[#fafaf8]">
                    <CardContent className="p-10">
                      <h3 className="font-display text-3xl text-charcoal font-semibold mb-4">
                        For the ones who train hard and deserve better fuel.
                      </h3>
                      <p className="font-body text-lg text-charcoal/80 leading-relaxed">
                        You're not just eating to survive—you're eating to perform, recover, and thrive. Whether you're crushing Muay Thai, flowing through Aerial Yoga, or building strength in Mat Pilates, your body deserves premium nutrition to match your premium effort.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Right: Join the Waitlist Form */}
              <div>
                <div className="sticky top-8">
                  <div className="mb-8" id="waitlist-form">
                    <h2 className="font-display text-4xl text-charcoal mb-6">
                      Join the Waitlist
                    </h2>
                    <p className="font-body text-xl text-charcoal/80 leading-relaxed">
                      Be the first to know when subscriptions open. Share your details and we'll reach out with exclusive early access pricing.
                    </p>
                  </div>

                  {/* Contact Form */}
                  <Card className="border-2 border-sage/30 shadow-2xl bg-white-warm">
                    <CardContent className="p-8 md:p-12">
                      {!isSuccess ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                          {/* Full Name */}
                          <div className="space-y-2">
                            <Label htmlFor="fullName" className="flex items-center gap-2 text-charcoal font-medium">
                              <User size={16} className="text-sage" />
                              Full Name *
                            </Label>
                            <Input
                              id="fullName"
                              name="fullName"
                              type="text"
                              required
                              value={formData.fullName}
                              onChange={handleChange}
                              placeholder="Enter your full name"
                              className="border-sage/30 focus:border-sage h-12 text-base"
                            />
                          </div>

                          {/* Email */}
                          <div className="space-y-2">
                            <Label htmlFor="email" className="flex items-center gap-2 text-charcoal font-medium">
                              <Mail size={16} className="text-sage" />
                              Email Address *
                            </Label>
                            <Input
                              id="email"
                              name="email"
                              type="email"
                              required
                              value={formData.email}
                              onChange={handleChange}
                              placeholder="your@email.com"
                              className="border-sage/30 focus:border-sage h-12 text-base"
                            />
                          </div>

                          {/* Phone */}
                          <div className="space-y-2">
                            <Label htmlFor="phone" className="flex items-center gap-2 text-charcoal font-medium">
                              <Phone size={16} className="text-sage" />
                              Phone Number *
                            </Label>
                            <Input
                              id="phone"
                              name="phone"
                              type="tel"
                              required
                              value={formData.phone}
                              onChange={handleChange}
                              placeholder="+91 xxxxx xxxxx"
                              className="border-sage/30 focus:border-sage h-12 text-base"
                            />
                          </div>

                          {/* Message */}
                          <div className="space-y-2">
                            <Label htmlFor="message" className="flex items-center gap-2 text-charcoal font-medium">
                              <MessageSquare size={16} className="text-sage" />
                              Additional Details (Optional)
                            </Label>
                            <Textarea
                              id="message"
                              name="message"
                              value={formData.message}
                              onChange={handleChange}
                              placeholder="Tell us about your dietary preferences, goals, or any questions..."
                              className="border-sage/30 focus:border-sage min-h-[120px] text-base"
                            />
                          </div>

                          {/* Submit Button */}
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            size="lg"
                            variant="sage"
                            className="w-full h-14 text-lg"
                          >
                            {isSubmitting ? "Submitting..." : "Join the Waitlist"}
                          </Button>

                          <p className="text-sm text-charcoal/60 text-center leading-relaxed">
                            By joining, you'll receive early access pricing and exclusive updates. We respect your inbox—no spam, just nourishment.
                          </p>
                        </form>
                      ) : (
                        <div className="text-center py-12">
                          <div className="w-24 h-24 rounded-full bg-sage/20 flex items-center justify-center mx-auto mb-8">
                            <Check className="text-sage" size={48} />
                          </div>
                          <h3 className="font-display text-4xl text-charcoal font-semibold mb-6">
                            You're on the List!
                          </h3>
                          <p className="font-body text-xl text-charcoal/80 leading-relaxed max-w-md mx-auto">
                            Thank you for your interest in Intentful Eating. We'll reach out soon with next steps and exclusive early access details.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
