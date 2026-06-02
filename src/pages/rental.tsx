import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Users, Clock, UtensilsCrossed, Sparkles, ArrowRight, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";

import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cdnUrl } from "@/lib/cdnUrl";

const STATS = [
  { value: "Up to 50", label: "Guests" },
  { value: "1,000 sq ft+", label: "Open space" },
  { value: "Natural", label: "Lighting" },
  { value: "4 or 8 hrs", label: "Bookings" },
];

const INCLUDED = [
  {
    icon: Users,
    title: "Up to 50 guests",
    description:
      "Flexible seating, from a lounge circle to theatre rows. We reset the room to whatever your gathering needs.",
  },
  {
    icon: Clock,
    title: "Half or full day",
    description:
      "Four-hour or eight-hour blocks, morning light or evening glow. Tell us the window and we hold it.",
  },
  {
    icon: UtensilsCrossed,
    title: "Plant-based catering",
    description:
      "Smoothie bowls, grazing boards, and coffee from our café, plated for your guests or laid out as a spread.",
  },
  {
    icon: Sparkles,
    title: "Sound & amenities",
    description:
      "PA system, mics, projector, yoga mats, and a room full of tropical plants and daylight. We handle the setup.",
  },
];

const GALLERY = [
  { src: cdnUrl("/events/Analog-1.jpeg"), alt: "Guests gathered over coffee at an Analog social evening", span: "md:col-span-7", h: "h-64 md:h-[440px]", caption: "Analog Social" },
  { src: cdnUrl("/coworking.jpg"), alt: "Daytime coworking layout in the sunlit studio", span: "md:col-span-5", h: "h-64 md:h-[440px]", caption: "Daytime gatherings" },
  { src: cdnUrl("/events/Work-Deli-1.jpeg"), alt: "A corporate offsite laid out across the café", span: "md:col-span-4", h: "h-56 md:h-72", caption: "Corporate offsites" },
  { src: cdnUrl("/events/Reading-social.png"), alt: "The monthly reading social in warm evening light", span: "md:col-span-4", h: "h-56 md:h-72", caption: "Reading socials" },
  { src: cdnUrl("/Heatlycafe.jpg"), alt: "Plant-based catering plated from the café", span: "md:col-span-4", h: "h-56 md:h-72", caption: "Café catering" },
  { src: cdnUrl("/events/Analog-3.jpeg"), alt: "A hands-on workshop in progress in the studio", span: "md:col-span-12", h: "h-64 md:h-80", caption: "Workshops & launches" },
];

const EVENT_TAGS = [
  "Workshops",
  "Celebrations",
  "Corporate offsites",
  "Product launches",
  "Supper clubs",
  "Photoshoots",
];

const EVENT_TYPES = [
  "Workshop",
  "Celebration / party",
  "Corporate / offsite",
  "Product launch",
  "Supper club",
  "Photoshoot",
  "Something else",
];

const DURATIONS = ["Half day (4 hours)", "Full day (8 hours)", "Not sure yet"];

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  eventType: "",
  eventDate: "",
  guestCount: "",
  duration: "",
  message: "",
};

export default function RentalPage() {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const setField = (name: keyof typeof EMPTY_FORM, value: string) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setField(e.target.name as keyof typeof EMPTY_FORM, e.target.value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setIsSuccess(false);

    try {
      const res = await fetch("/api/rental-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not send your request. Try again.");
        return;
      }
      setIsSuccess(true);
      setFormData(EMPTY_FORM);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SEO
        title="Host Your Event | The Studio by Copper + Cloves"
        description="Host your next workshop, celebration, or corporate offsite in our plant-filled, light-filled sanctuary. Flexible bookings, café catering, and up to 50 guests."
        image={cdnUrl("/og-image.png")}
      />

      <div className="min-h-screen bg-cream">
        {/* Hero — asymmetric, image-led */}
        <section className="px-6 pt-28 pb-14 md:pt-32 md:pb-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-stretch gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
            <div className="flex flex-col justify-center">
              <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
                Private hire · Events
              </p>
              <h1 className="mt-4 font-display text-5xl leading-[1.02] text-charcoal md:text-7xl">
                <span className="italic text-sage">Host</span> your event
                <br className="hidden sm:block" /> in our sanctuary.
              </h1>
              <p className="mt-6 max-w-[52ch] font-body text-lg leading-relaxed text-charcoal/75 md:text-xl">
                Workshops, celebrations, supper clubs, and offsites, in a plant-filled, light-filled
                room built for connection. You bring the people. We hold the space.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button asChild variant="sage" size="lg">
                  <Link href="#enquire">
                    Enquire about a date
                    <ArrowRight size={18} />
                  </Link>
                </Button>
                <Link
                  href="#gallery"
                  className="group inline-flex items-center gap-1.5 font-body text-sm font-semibold text-sage transition-colors duration-200 hover:text-[#7A8B7C]"
                >
                  See the space
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </Link>
              </div>
            </div>

            <div className="group relative min-h-[340px] overflow-hidden rounded-3xl shadow-[0_8px_48px_-8px_rgba(51,51,51,0.16)] lg:min-h-full">
              <Image
                src={cdnUrl("/cafe-studio.jpg")}
                alt="The light-filled event space at The Studio by Copper and Cloves, set with plants and warm timber"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
                quality={90}
              />
              <div className="absolute inset-0 bg-linear-to-t from-charcoal/45 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 sm:right-auto">
                <div className="inline-flex items-center gap-4 rounded-2xl bg-white-warm p-5 shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sage/10">
                    <Users className="text-sage" size={28} />
                  </span>
                  <div>
                    <p className="font-body text-xs uppercase tracking-[0.1em] text-charcoal/55">Capacity</p>
                    <p className="font-display text-2xl text-charcoal md:text-3xl">Up to 50 guests</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stat strip */}
          <div className="mx-auto mt-12 flex max-w-7xl flex-wrap justify-center divide-y divide-[#e5e4dc] border-y border-[#e5e4dc] sm:divide-x sm:divide-y-0">
            {STATS.map((stat) => (
              <div key={stat.label} className="w-1/2 px-6 py-5 text-center sm:w-auto sm:flex-1 sm:px-10">
                <p className="font-display text-2xl text-charcoal md:text-3xl">{stat.value}</p>
                <p className="mt-1 font-body text-xs uppercase tracking-[0.1em] text-charcoal/55">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Gallery — editorial, asymmetric */}
        <section id="gallery" className="scroll-mt-24 px-6 py-16 md:py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-2xl">
              <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
                The space, in use
              </p>
              <h2 className="mt-3 font-display text-4xl leading-[1.08] text-charcoal md:text-5xl">
                Where it all <span className="italic text-sage">happens</span>.
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-12 md:gap-5">
              {GALLERY.map(({ src, alt, span, h, caption }) => (
                <figure
                  key={src}
                  className={`group relative overflow-hidden rounded-3xl ${span} ${h}`}
                >
                  <Image
                    src={src}
                    alt={alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
                    quality={88}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-charcoal/55 via-transparent to-transparent" />
                  <figcaption className="absolute bottom-4 left-5 font-body text-sm font-medium tracking-wide text-cream/95 drop-shadow">
                    {caption}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* What's included — editorial list (left intro / right feature rows) */}
        <section className="bg-[#f4f3ec] px-6 py-16 md:py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
                Everything taken care of
              </p>
              <h2 className="mt-3 font-display text-4xl leading-[1.08] text-charcoal md:text-5xl">
                Turn the room into <span className="italic text-sage">yours</span>.
              </h2>
              <p className="mt-5 max-w-[48ch] font-body text-lg leading-relaxed text-charcoal/75">
                One booking covers the space and the details. Tell us the shape of your day and we
                arrange the rest, so you can be with your guests, not the logistics.
              </p>

              <div className="mt-8 flex flex-wrap gap-2.5">
                {EVENT_TAGS.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-sage/20 bg-sand px-4 py-1.5 font-body text-sm text-charcoal/75"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <ul className="divide-y divide-[#e5e4dc] border-y border-[#e5e4dc]">
              {INCLUDED.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex gap-5 py-7 first:pt-0 last:pb-0">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage/10">
                    <Icon className="text-sage" size={20} />
                  </span>
                  <div>
                    <h3 className="font-display text-2xl leading-tight text-charcoal">{title}</h3>
                    <p className="mt-2 max-w-[52ch] font-body leading-relaxed text-charcoal/70">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Enquiry — form + context */}
        <section id="enquire" className="scroll-mt-24 px-6 py-16 md:py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.1fr] lg:gap-16">
            {/* Context panel */}
            <div className="flex flex-col">
              <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
                Let&rsquo;s plan it
              </p>
              <h2 className="mt-3 font-display text-4xl leading-[1.08] text-charcoal md:text-5xl">
                Tell us about your <span className="italic text-sage">event</span>.
              </h2>
              <p className="mt-5 max-w-[46ch] font-body text-lg leading-relaxed text-charcoal/75">
                Share a few details and our team will come back within 24 hours with availability and
                a quote shaped to your day.
              </p>

              <dl className="mt-8 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage/10">
                    <MapPin className="text-sage" size={18} />
                  </span>
                  <div>
                    <dt className="font-body text-xs uppercase tracking-[0.1em] text-charcoal/55">Where</dt>
                    <dd className="font-body text-charcoal/80">The Studio by Copper + Cloves, Bangalore</dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage/10">
                    <Mail className="text-sage" size={18} />
                  </span>
                  <div>
                    <dt className="font-body text-xs uppercase tracking-[0.1em] text-charcoal/55">Reply time</dt>
                    <dd className="font-body text-charcoal/80">Within 24 hours, every enquiry</dd>
                  </div>
                </div>
              </dl>

              <div className="relative mt-10 hidden overflow-hidden rounded-3xl lg:block lg:flex-1 lg:min-h-[220px]">
                <Image
                  src={cdnUrl("/coworking.jpg")}
                  alt="Members and friends gathered in the studio social space"
                  fill
                  sizes="40vw"
                  className="object-cover"
                  quality={88}
                />
              </div>
            </div>

            {/* Form */}
            <div>
              {isSuccess ? (
                <div className="rounded-3xl border border-sage/20 bg-sage/5 p-10 text-center md:p-14">
                  <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sage/15">
                    <Calendar className="text-sage" size={32} />
                  </span>
                  <h3 className="font-display text-3xl text-charcoal">Request received.</h3>
                  <p className="mx-auto mt-3 max-w-[42ch] font-body text-lg leading-relaxed text-charcoal/70">
                    Thank you. Our team will review your event and reach out within 24 hours.
                  </p>
                  <Button variant="sage-outline" size="lg" className="mt-8" onClick={() => setIsSuccess(false)}>
                    Send another enquiry
                  </Button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="rounded-3xl border border-[#e5e4dc] bg-white-warm p-6 sm:p-8 md:p-10"
                >
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label="Full name" required>
                      <Input name="name" value={formData.name} onChange={handleChange} required placeholder="Your name" />
                    </Field>
                    <Field label="Email" required>
                      <Input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="you@email.com" />
                    </Field>
                    <Field label="Phone" required>
                      <Input type="tel" name="phone" value={formData.phone} onChange={handleChange} required placeholder="+91 98765 43210" />
                    </Field>
                    <Field label="Event type">
                      <Select value={formData.eventType} onValueChange={(v) => setField("eventType", v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose one" />
                        </SelectTrigger>
                        <SelectContent>
                          {EVENT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Preferred date">
                      <Input type="date" name="eventDate" value={formData.eventDate} onChange={handleChange} />
                    </Field>
                    <Field label="Guest count">
                      <Input type="number" name="guestCount" value={formData.guestCount} onChange={handleChange} min="1" max="50" placeholder="e.g. 20" />
                    </Field>
                    <Field label="Duration" className="sm:col-span-2">
                      <Select value={formData.duration} onValueChange={(v) => setField("duration", v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Half day, full day, or unsure" />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATIONS.map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Anything else" className="sm:col-span-2">
                      <Textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        rows={4}
                        className="resize-none"
                        placeholder="Tell us about your event, catering, layout, or special requests."
                      />
                    </Field>
                  </div>

                  <Button type="submit" size="lg" variant="sage" disabled={isSubmitting} className="mt-8 w-full">
                    {isSubmitting ? "Sending..." : "Send enquiry"}
                  </Button>
                  <p className="mt-3 text-center font-body text-xs text-charcoal/50">
                    No commitment. We&rsquo;ll reply with availability and a quote.
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block font-body text-sm font-medium text-charcoal/75">
        {label} {required && <span className="text-terracotta">*</span>}
      </span>
      {children}
    </label>
  );
}
