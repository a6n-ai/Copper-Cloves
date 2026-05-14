import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Users, Clock, Mail, Phone, User, MessageSquare } from "lucide-react";
import Image from "next/image";

export default function RentalPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    eventType: "",
    eventDate: "",
    guestCount: "",
    duration: "",
    message: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setIsSuccess(false);

    try {
      const res = await fetch("/api/rental-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          eventType: formData.eventType,
          eventDate: formData.eventDate,
          guestCount: formData.guestCount,
          duration: formData.duration,
          message: formData.message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === "string" ? data.error : "Could not send your request. Try again.");
        return;
      }
      setIsSuccess(true);
      setFormData({
        name: "",
        email: "",
        phone: "",
        eventType: "",
        eventDate: "",
        guestCount: "",
        duration: "",
        message: "",
      });
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const eventGallery = [
    "/cafe-studio.jpg",
    "/coworking.jpg",
    "/Heatlycafe.jpg",
    "/cafe-hero-shelves.jpg"
  ];

  return (
    <>
      <SEO
        title="Rent Our Space | The Studio by Copper + Cloves"
        description="Host your next workshop, celebration, or corporate event in our beautifully designed sanctuary. Flexible bookings, full-service experience, up to 50 guests."
        image="/og-image.png"
      />
      <div className="min-h-screen bg-cream">
        <Navigation />

        {/* Hero Section */}
        <section className="relative pt-32 pb-20 px-6 lg:px-8 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-sage/5 to-transparent" />
          
          <div className="relative z-10 max-w-7xl mx-auto text-center">
            <h1 className="font-display text-5xl md:text-7xl text-charcoal mb-6">
              <span className="italic text-sage">Your</span> Space.<br />
              <span className="italic text-sage">Your</span> Vision.
            </h1>
            <p className="font-body text-xl md:text-2xl text-charcoal/80 max-w-3xl mx-auto leading-relaxed">
              Host workshops, celebrations, corporate events, or intimate gatherings 
              in a sanctuary designed for connection and creativity.
            </p>
          </div>
        </section>

        {/* Gallery Section */}
        <section className="py-16 px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-display text-4xl md:text-5xl text-charcoal mb-4">
                Past Events & Gatherings
              </h2>
              <p className="font-body text-lg text-charcoal/70">
                See how others have transformed our space for their special moments
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {eventGallery.map((image, index) => (
                <div 
                  key={image}
                  className="relative h-[400px] rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
                >
                  <Image
                    src={image}
                    alt={`Event ${index + 1}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                    quality={90}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal/40 via-transparent to-transparent" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What's Included + Booking Form - Side by Side */}
        <section className="py-16 px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16">
              
              {/* Left: What's Included */}
              <div>
                <div className="mb-12">
                  <h2 className="font-display text-4xl md:text-5xl text-charcoal mb-4">
                    What's Included
                  </h2>
                </div>

                <div className="space-y-6">
                  {/* Feature 1 */}
                  <div className="p-8 rounded-2xl bg-cream border border-sage/10">
                    <div className="w-16 h-16 rounded-full bg-sage/10 flex items-center justify-center mb-4">
                      <Users className="text-sage" size={32} />
                    </div>
                    <h3 className="font-display text-2xl text-charcoal mb-3">
                      Capacity
                    </h3>
                    <p className="font-body text-charcoal/70">
                      Comfortably accommodates up to 50 guests with flexible seating arrangements
                    </p>
                  </div>

                  {/* Feature 2 */}
                  <div className="p-8 rounded-2xl bg-cream border border-sage/10">
                    <div className="w-16 h-16 rounded-full bg-sage/10 flex items-center justify-center mb-4">
                      <Clock className="text-sage" size={32} />
                    </div>
                    <h3 className="font-display text-2xl text-charcoal mb-3">
                      Flexible Timing
                    </h3>
                    <p className="font-body text-charcoal/70">
                      Half-day (4 hours) or full-day (8 hours) bookings available to suit your needs
                    </p>
                  </div>

                  {/* Feature 3 */}
                  <div className="p-8 rounded-2xl bg-cream border border-sage/10">
                    <div className="w-16 h-16 rounded-full bg-sage/10 flex items-center justify-center mb-4">
                      <Calendar className="text-sage" size={32} />
                    </div>
                    <h3 className="font-display text-2xl text-charcoal mb-3">
                      Premium Amenities
                    </h3>
                    <p className="font-body text-charcoal/70">
                      Sound system, yoga mats, natural lighting, tropical plants, and café catering available
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Booking Form */}
              <div>
                <div className="sticky top-8">
                  <div className="mb-8">
                    <h2 className="font-display text-4xl md:text-5xl text-charcoal mb-4">
                      Book Your Event
                    </h2>
                    <p className="font-body text-lg text-charcoal/70">
                      Fill out the form below and we'll get back to you within 24 hours
                    </p>
                  </div>

                  {isSuccess ? (
                    <div className="bg-sage/10 border border-sage/20 rounded-2xl p-12 text-center">
                      <div className="w-20 h-20 rounded-full bg-sage/20 flex items-center justify-center mx-auto mb-6">
                        <Calendar className="text-sage" size={40} />
                      </div>
                      <h3 className="font-display text-3xl text-charcoal mb-3">
                        Request Submitted!
                      </h3>
                      <p className="font-body text-charcoal/70 text-lg">
                        Thank you for your interest! Our team will review your request and reach out within 24 hours.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="bg-white rounded-2xl p-8 shadow-xl border border-sage/10">
                        {/* Name */}
                        <div className="mb-6">
                          <label className="flex items-center gap-2 font-body text-sm text-charcoal/70 mb-2">
                            <User size={16} />
                            Full Name *
                          </label>
                          <Input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className="w-full"
                            placeholder="John Doe"
                          />
                        </div>

                        {/* Email */}
                        <div className="mb-6">
                          <label className="flex items-center gap-2 font-body text-sm text-charcoal/70 mb-2">
                            <Mail size={16} />
                            Email Address *
                          </label>
                          <Input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="w-full"
                            placeholder="john@example.com"
                          />
                        </div>

                        {/* Phone */}
                        <div className="mb-6">
                          <label className="flex items-center gap-2 font-body text-sm text-charcoal/70 mb-2">
                            <Phone size={16} />
                            Phone Number *
                          </label>
                          <Input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            required
                            className="w-full"
                            placeholder="+91 98765 43210"
                          />
                        </div>

                        {/* Event Type */}
                        <div className="mb-6">
                          <label className="flex items-center gap-2 font-body text-sm text-charcoal/70 mb-2">
                            <MessageSquare size={16} />
                            Event Type *
                          </label>
                          <Input
                            type="text"
                            name="eventType"
                            value={formData.eventType}
                            onChange={handleChange}
                            required
                            className="w-full"
                            placeholder="Workshop, Birthday, Corporate Event, etc."
                          />
                        </div>

                        {/* Event Date */}
                        <div className="grid md:grid-cols-2 gap-6 mb-6">
                          <div>
                            <label className="flex items-center gap-2 font-body text-sm text-charcoal/70 mb-2">
                              <Calendar size={16} />
                              Preferred Date *
                            </label>
                            <Input
                              type="date"
                              name="eventDate"
                              value={formData.eventDate}
                              onChange={handleChange}
                              required
                              className="w-full"
                            />
                          </div>

                          <div>
                            <label className="flex items-center gap-2 font-body text-sm text-charcoal/70 mb-2">
                              <Users size={16} />
                              Guest Count *
                            </label>
                            <Input
                              type="number"
                              name="guestCount"
                              value={formData.guestCount}
                              onChange={handleChange}
                              required
                              min="1"
                              max="50"
                              className="w-full"
                              placeholder="20"
                            />
                          </div>
                        </div>

                        {/* Duration */}
                        <div className="mb-6">
                          <label className="flex items-center gap-2 font-body text-sm text-charcoal/70 mb-2">
                            <Clock size={16} />
                            Duration *
                          </label>
                          <Input
                            type="text"
                            name="duration"
                            value={formData.duration}
                            onChange={handleChange}
                            required
                            className="w-full"
                            placeholder="Half-day (4 hours) or Full-day (8 hours)"
                          />
                        </div>

                        {/* Message */}
                        <div className="mb-6">
                          <label className="flex items-center gap-2 font-body text-sm text-charcoal/70 mb-2">
                            <MessageSquare size={16} />
                            Additional Details
                          </label>
                          <Textarea
                            name="message"
                            value={formData.message}
                            onChange={handleChange}
                            rows={5}
                            className="w-full resize-none"
                            placeholder="Tell us more about your event, special requirements, catering needs, etc."
                          />
                        </div>

                        {/* Submit Button */}
                        <Button
                          type="submit"
                          size="lg"
                          disabled={isSubmitting}
                          className="w-full bg-sage text-white hover:bg-sage/90 py-6 text-base rounded-full shadow-xl"
                        >
                          {isSubmitting ? "Submitting..." : "Submit Booking Request"}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}