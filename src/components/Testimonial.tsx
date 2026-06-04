import Image from "next/image";
import { useState, useEffect } from "react";

const testimonials = [
  {
    text: "The Studio is exactly what I was looking for. The transition from a sweat-inducing Muay Thai session to sipping a post-workout smoothie bowl in their sun-drenched café is pure magic. It truly is my sanctuary in the city.",
    author: "Priya Sharma",
    role: "Member since 2023",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=faces",
    rating: 5
  },
  {
    text: "Amazing space with incredible instructors! The Mat Pilates classes have transformed my core strength. Love the community vibe and the café is a perfect bonus for working remotely between sessions.",
    author: "Arjun Patel",
    role: "Regular Member",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces",
    rating: 5
  },
  {
    text: "Best wellness studio in Bangalore! The Physique 57 classes are challenging yet accessible. The instructors genuinely care about your progress and the plant-based café offerings are delicious and nourishing.",
    author: "Sneha Reddy",
    role: "Premium Member",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces",
    rating: 5
  },
  {
    text: "I've tried many studios in the city, but this one stands out. The variety of classes keeps things interesting, and the atmosphere is so welcoming. The Hatha Yoga sessions are my favorite way to start the day.",
    author: "Rahul Kumar",
    role: "Member since 2024",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces",
    rating: 5
  },
  {
    text: "The Aerial Yoga classes here are absolutely phenomenal! Never thought I'd feel so strong and centered while suspended in the air. The instructors are patient and the space is beautifully maintained.",
    author: "Ananya Iyer",
    role: "Specialty Member",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=faces",
    rating: 5
  },
  {
    text: "From Warrior Strength to smoothie bowls at the café - this place has it all! The community here is supportive and motivating. Best investment in my health and wellness journey.",
    author: "Vikram Singh",
    role: "Member since 2023",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=faces",
    rating: 5
  }
];

export function Testimonial() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
        setIsAnimating(false);
      }, 500);
    }, 6000); // Change testimonial every 6 seconds

    return () => clearInterval(interval);
  }, []);

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
        <div className={`transition-opacity duration-500 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
          <blockquote className="font-display text-2xl md:text-3xl leading-relaxed mb-8 text-center">
            "{currentTestimonial.text}"
          </blockquote>
          
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 rounded-full overflow-hidden mr-4 border-2 border-cream/30">
              <Image
                src={currentTestimonial.image}
                alt={currentTestimonial.author}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-left">
              <div className="font-display font-semibold text-xl">{currentTestimonial.author}</div>
              <div className="font-body text-sm text-cream/80">{currentTestimonial.role}</div>
            </div>
          </div>
        </div>

        {/* Pagination Dots */}
        <div className="flex justify-center gap-1 mt-12">
          {testimonials.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                setIsAnimating(true);
                setTimeout(() => {
                  setCurrentIndex(index);
                  setIsAnimating(false);
                }, 500);
              }}
              className="group grid min-h-[24px] min-w-[24px] place-items-center"
              aria-label={`Go to testimonial ${index + 1}`}
              aria-current={index === currentIndex}
            >
              <span
                className={`block transition-all duration-300 rounded-full ${
                  index === currentIndex
                    ? 'w-8 h-2 bg-white-warm'
                    : 'w-2 h-2 bg-[#fafaf8]/40 group-hover:bg-[#fafaf8]/60'
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}