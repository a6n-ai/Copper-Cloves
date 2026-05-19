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
            <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
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
            <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
              <span className="font-script text-white/90 text-2xl sm:text-3xl md:text-4xl tracking-wider">refuel</span>
            </div>
          </div>

          {/* Panel 3: Connect */}
          <div className="relative flex-1 min-h-0 overflow-hidden lg:flex-none lg:h-full group">
            <video
              src="/Connect-1.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover animate-floatAndZoom23"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
              <span className="font-script text-white/90 text-2xl sm:text-3xl md:text-4xl tracking-wider">connect</span>
            </div>
          </div>
        </div>

        {/* Headline — light glass; copy forced to ~6 lines */}
        <div className="pointer-events-none absolute inset-0 z-20 hidden lg:flex flex-col items-center justify-center px-4 sm:px-6">
          <div className="pointer-events-auto w-full max-w-xl rounded-4xl border border-white/10 bg-black/1 p-8 text-center shadow-none backdrop-blur-xs sm:max-w-2xl sm:p-10 xl:rounded-[2.5rem] xl:p-11 2xl:p-12">
            <h1 className="font-anchor-black mb-3 text-5xl text-white drop-shadow-2xl lg:text-6xl leading-tight">
              {"We're more than a studio,"}
              <br />
              {"We're your home away from home"}
            </h1>
            <p className="font-display mx-auto mt-4 max-w-none text-base font-normal leading-snug text-white xl:text-lg xl:leading-relaxed 2xl:text-xl [text-shadow:0_1px_2px_rgba(0,0,0,0.8),0_0_20px_rgba(0,0,0,0.35)]">
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
          <h1 className="font-anchor-black text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl text-charcoal mb-6 leading-tight">
            We're more than a studio,<br />
            We're your home away from home
          </h1>
          <p className="font-body text-lg sm:text-xl md:text-2xl text-charcoal/80 leading-relaxed max-w-2xl mx-auto">
            <span className="font-script text-2xl sm:text-3xl text-charcoal">move</span> your body,{" "}
            <span className="font-script text-2xl sm:text-3xl text-charcoal">refuel</span> with a coffee and a smoothie bowl,
            <br className="hidden sm:block" />
            work from our cafe and find your{" "}
            <span className="font-script text-2xl sm:text-3xl text-charcoal">community</span>
          </p>
        </div>
      </section>
    </>
  );
}