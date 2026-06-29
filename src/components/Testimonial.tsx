import { useState, useEffect } from "react";
import { Pause, Play } from "lucide-react";
import { useReducedMotion } from "framer-motion";

const testimonials = [
  {
    text: "The Studio is exactly what I was looking for. The transition from a sweat-inducing Muay Thai session to sipping a post-workout smoothie bowl in their sun-drenched café is pure magic. It truly is my sanctuary in the city.",
    author: "Priya Sharma",
    role: "Member since 2023"
  },
  {
    text: "Amazing space with incredible instructors! The Mat Pilates classes have transformed my core strength. Love the community vibe and the café is a perfect bonus for working remotely between sessions.",
    author: "Arjun Patel",
    role: "Regular Member"
  },
  {
    text: "Best wellness studio in Bangalore! The Physique 57 classes are challenging yet accessible. The instructors genuinely care about your progress and the plant-based café offerings are delicious and nourishing.",
    author: "Sneha Reddy",
    role: "Premium Member"
  },
  {
    text: "I've tried many studios in the city, but this one stands out. The variety of classes keeps things interesting, and the atmosphere is so welcoming. The Hatha Yoga sessions are my favorite way to start the day.",
    author: "Rahul Kumar",
    role: "Member since 2024"
  },
  {
    text: "The Aerial Yoga classes here are absolutely phenomenal! Never thought I'd feel so strong and centered while suspended in the air. The instructors are patient and the space is beautifully maintained.",
    author: "Ananya Iyer",
    role: "Specialty Member"
  },
  {
    text: "From Warrior Strength to smoothie bowls at the café - this place has it all! The community here is supportive and motivating. Best investment in my health and wellness journey.",
    author: "Vikram Singh",
    role: "Member since 2023"
  }
];

function getInitials(author: string): string {
  const words = author.trim().split(/\s+/);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Testimonial() {
  const reduce = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [paused, setPaused] = useState(false);

  // Reduced-motion: switch instantly, no cross-fade. Otherwise fade out, swap,
  // fade back in.
  const goTo = (next: number) => {
    if (reduce) {
      setCurrentIndex(next);
      return;
    }
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex(next);
      setIsAnimating(false);
    }, 500);
  };

  useEffect(() => {
    // Honor prefers-reduced-motion and the manual pause control: no auto-rotate.
    if (reduce || paused) return;
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
        setIsAnimating(false);
      }, 500);
    }, 6000); // Change testimonial every 6 seconds

    return () => clearInterval(interval);
  }, [reduce, paused]);

  const currentTestimonial = testimonials[currentIndex];

  return (
    <section className="py-14 md:py-20 bg-sage text-cream relative overflow-hidden">
      <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl md:text-5xl mb-4">
            What Our Community Says
          </h2>
          <p className="font-body text-cream/80 text-lg">
            In their own words, from {testimonials.length} members of the studio
          </p>
        </div>

        {/* Testimonial Content with Fade Animation */}
        <div
          aria-live="polite"
          className={`transition-opacity duration-500 motion-reduce:transition-none ${
            isAnimating ? "opacity-0" : "opacity-100"
          }`}
        >
          <blockquote className="font-display text-2xl md:text-3xl leading-relaxed mb-8 text-center">
            "{currentTestimonial.text}"
          </blockquote>
          
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 rounded-full overflow-hidden mr-4 border-2 border-cream/30 bg-white-warm text-sage font-body font-semibold flex items-center justify-center text-lg">
              {getInitials(currentTestimonial.author)}
            </div>
            <div className="text-left">
              <div className="font-body font-semibold text-xl">{currentTestimonial.author}</div>
              <div className="font-body text-sm text-cream/80">{currentTestimonial.role}</div>
            </div>
          </div>
        </div>

        {/* Pause control + Pagination Dots */}
        <div className="mt-12 flex items-center justify-center gap-4">
          {!reduce && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Play testimonials" : "Pause testimonials"}
              aria-pressed={paused}
              className="grid h-9 w-9 place-items-center rounded-full border border-cream/30 text-cream/80 transition-colors duration-200 hover:bg-white-warm/10 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-sage"
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          )}
          <div className="flex justify-center gap-1">
            {testimonials.map((testimonial, index) => (
              <button
                key={testimonial.author}
                type="button"
                onClick={() => goTo(index)}
                className="group grid min-h-6 min-w-6 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-sage"
                aria-label={`Go to testimonial ${index + 1}`}
                aria-current={index === currentIndex}
              >
                <span
                  className={`block transition-all duration-300 rounded-full motion-reduce:transition-none ${
                    index === currentIndex
                      ? "w-8 h-2 bg-white-warm"
                      : "w-2 h-2 bg-white-warm/40 group-hover:bg-white-warm/60"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}