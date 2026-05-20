import { useState, useEffect } from "react";
import { cdnUrl } from "@/lib/cdnUrl";
export function Hero() {
  const [moveIndex, setMoveIndex] = useState(0);
  const [refuelIndex, setRefuelIndex] = useState(0);

  const moveMedia = [cdnUrl("/Move-1.mp4"), cdnUrl("/Move-2.mp4")];
  const refuelMedia = [cdnUrl("/Refuel-1.mp4"), cdnUrl("/refuel-2.jpeg"), cdnUrl("/refuel-3.mp4")];

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
      {/* Hero: three columns on lg+, stacked on smaller screens */}
      <section className="relative h-screen w-full overflow-hidden">
        <div className="flex h-full min-h-0 flex-col lg:grid lg:grid-cols-3 lg:h-full">
          {/* Panel 1: Move */}
          <div className="relative flex-1 min-h-0 overflow-hidden lg:flex-none lg:h-full group">
            {moveMedia.map((media, index) => (
              <div
                key={media}
                className={`absolute inset-0 transition-opacity duration-2000 ease-in-out ${
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
            <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
              <span className="font-script text-white/90 text-2xl sm:text-3xl md:text-4xl tracking-wider">move</span>
            </div>
          </div>

          {/* Panel 2: Refuel — vertical rules only here (flanks middle image) */}
          <div className="relative flex-1 min-h-0 overflow-hidden lg:flex-none lg:h-full lg:border-x lg:border-black group">
            {refuelMedia.map((media, index) => (
              <div
                key={media}
                className={`absolute inset-0 transition-opacity duration-2000 ease-in-out ${
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
            <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
              <span className="font-script text-white/90 text-2xl sm:text-3xl md:text-4xl tracking-wider">refuel</span>
            </div>
          </div>

          {/* Panel 3: Connect */}
          <div className="relative flex-1 min-h-0 overflow-hidden lg:flex-none lg:h-full group">
            <video
              src={cdnUrl("/Connect-1.mp4")}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover animate-floatAndZoom23"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
              <span className="font-script text-white/90 text-2xl sm:text-3xl md:text-4xl tracking-wider">connect</span>
            </div>
          </div>
        </div>

        {/* Single full-hero overlay — spans all 3 panels, no box edges */}
        <div className="absolute inset-0 z-10 bg-black/25 pointer-events-none" />

        {/* Headline — no box, text floats directly over overlay */}
        <div className="pointer-events-none absolute inset-0 z-20 hidden lg:flex flex-col items-center justify-center px-8">
          <div className="pointer-events-auto w-full max-w-5xl text-center">
            <h1 className="font-display mb-6 text-6xl lg:text-7xl xl:text-8xl text-white drop-shadow-2xl leading-[1.05]">
              <span className="italic text-white/90">{"We're more than a studio,"}</span>
              <br />
              {"We're your home away from home"}
            </h1>
            <p className="font-body mx-auto mt-6 text-xl lg:text-2xl xl:text-2xl font-light leading-relaxed text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.8),0_0_20px_rgba(0,0,0,0.35)]">
              <span className="italic">move</span> your body, <span className="italic">refuel</span> with a coffee and a smoothie bowl,
              <br />
              work from our cafe and find your <span className="italic">community</span>
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

      {/* Headline — mobile / tablet only (under hero stack) */}
      <section className="bg-white py-8 sm:py-10 lg:hidden px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl text-charcoal mb-6 leading-[1.05]">
            <span className="italic text-charcoal/70">We're more than a studio,</span><br />
            We're your home away from home
          </h1>
          <p className="font-body text-lg sm:text-xl md:text-2xl text-charcoal/80 font-light leading-relaxed max-w-2xl mx-auto">
            <span className="italic">move</span> your body,{" "}
            <span className="italic">refuel</span> with a coffee and a smoothie bowl,
            <br className="hidden sm:block" />
            work from our cafe and find your{" "}
            <span className="italic">community</span>
          </p>
        </div>
      </section>
    </>
  );
}