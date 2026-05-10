import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

export function Hero() {
  const [moveIndex, setMoveIndex] = useState(0);
  const [refuelIndex, setRefuelIndex] = useState(0);

  const moveMedia = ["/Move-1.mp4", "/Move-2.mp4"];
  const refuelMedia = ["/Refuel-1.mp4", "/refuel-2.jpeg", "/refuel-3.mp4"];

  useEffect(() => {
    const moveInterval = setInterval(() => {
      setMoveIndex((prev) => (prev + 1) % moveMedia.length);
    }, 8000);

    return () => clearInterval(moveInterval);
  }, []);

  useEffect(() => {
    const refuelInterval = setInterval(() => {
      setRefuelIndex((prev) => (prev + 1) % refuelMedia.length);
    }, 9000);

    return () => clearInterval(refuelInterval);
  }, []);

  return (
    <>
      {/* Hero Video Section */}
      <section className="relative h-screen w-full overflow-hidden">
        <div className="flex flex-col lg:grid lg:grid-cols-3 h-full">
          {/* Column 1: Move */}
          <div className="relative h-full overflow-hidden group">
            {moveMedia.map((media, index) => (
              <div
                key={media}
                className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out ${
                  index === moveIndex ? "opacity-100" : "opacity-0"
                }`}
              >
                <video
                  src={media}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover animate-floatAndZoom17"
                />
              </div>
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
              <span className="font-script text-white/90 text-2xl sm:text-3xl md:text-4xl tracking-wider">move</span>
            </div>
          </div>

          {/* Column 2: Refuel */}
          <div className="relative h-full overflow-hidden group">
            {refuelMedia.map((media, index) => (
              <div
                key={media}
                className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out ${
                  index === refuelIndex ? "opacity-100" : "opacity-0"
                }`}
              >
                {media.endsWith(".mp4") ? (
                  <video
                    src={media}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover animate-floatAndZoom19"
                  />
                ) : (
                  <img
                    src={media}
                    alt="Refuel"
                    className="w-full h-full object-cover animate-floatAndZoom19"
                  />
                )}
              </div>
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
              <span className="font-script text-white/90 text-2xl sm:text-3xl md:text-4xl tracking-wider">refuel</span>
            </div>
          </div>

          {/* Column 3: Connect */}
          <div className="relative h-full overflow-hidden group">
            <video
              src="/Connect-1.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover animate-floatAndZoom23"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
              <span className="font-script text-white/90 text-2xl sm:text-3xl md:text-4xl tracking-wider">connect</span>
            </div>
          </div>
        </div>

        {/* Central Text Overlay - Desktop Only */}
        <div className="hidden lg:flex absolute inset-0 flex-col items-center justify-center z-20 px-6">
          <div className="backdrop-blur-sm bg-black/10 rounded-2xl p-8 max-w-3xl text-center">
            <h1 className="font-anchor-black text-5xl lg:text-6xl text-white drop-shadow-2xl mb-4 leading-tight">
              We're more than a studio,<br />
              We're your home away from home
            </h1>
            <p className="font-body text-xl lg:text-2xl text-white/95 drop-shadow-lg leading-relaxed">
              <span className="font-script text-3xl">move</span> your body, <span className="font-script text-3xl">refuel</span> with a coffee and a smoothie bowl,<br />
              work from our cafe and find your <span className="font-script text-3xl">community</span>
            </p>
          </div>
        </div>

        <style jsx>{`
          @keyframes floatAndZoom17 {
            0%, 100% {
              transform: translateY(0%) scale(1.0);
            }
            25% {
              transform: translateY(-2%) scale(1.03);
            }
            50% {
              transform: translateY(0%) scale(1.05);
            }
            75% {
              transform: translateY(2%) scale(1.03);
            }
          }

          @keyframes floatAndZoom19 {
            0%, 100% {
              transform: translateY(0%) scale(1.0);
            }
            25% {
              transform: translateY(-2%) scale(1.03);
            }
            50% {
              transform: translateY(0%) scale(1.05);
            }
            75% {
              transform: translateY(2%) scale(1.03);
            }
          }

          @keyframes floatAndZoom23 {
            0%, 100% {
              transform: translateY(0%) scale(1.0);
            }
            25% {
              transform: translateY(-2%) scale(1.03);
            }
            50% {
              transform: translateY(0%) scale(1.05);
            }
            75% {
              transform: translateY(2%) scale(1.03);
            }
          }

          .animate-floatAndZoom17 {
            animation: floatAndZoom17 17s ease-in-out infinite;
          }

          .animate-floatAndZoom19 {
            animation: floatAndZoom19 19s ease-in-out infinite;
          }

          .animate-floatAndZoom23 {
            animation: floatAndZoom23 23s ease-in-out infinite;
          }
        `}</style>
      </section>

      {/* Hero Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-32 pb-24">
        <div className="text-center">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <img 
              src="/logo2.png" 
              alt="The Studio Logo" 
              className="h-24 md:h-32 w-auto"
              style={{ filter: 'brightness(0)' }}
            />
          </div>
        </div>
      </div>

      {/* Text Section Below Hero - Mobile/Tablet Only */}
      <section className="lg:hidden bg-white py-12 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-anchor-black text-3xl sm:text-4xl md:text-5xl text-charcoal mb-6 leading-tight">
            We're more than a studio,<br />
            We're your home away from home
          </h1>
          <p className="font-body text-lg sm:text-xl md:text-2xl text-charcoal/80 leading-relaxed">
            <span className="font-script text-2xl sm:text-3xl text-charcoal">move</span> your body, <span className="font-script text-2xl sm:text-3xl text-charcoal">refuel</span> with a coffee and a smoothie bowl,<br className="hidden sm:block" />
            work from our cafe and find your <span className="font-script text-2xl sm:text-3xl text-charcoal">community</span>
          </p>
        </div>
      </section>
    </>
  );
}