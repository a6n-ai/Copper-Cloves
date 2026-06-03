import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Ticket, ArrowRight } from "lucide-react";
import { cdnUrl } from "@/lib/cdnUrl";
import { BLUR_DATA_URL } from "@/lib/imageBlur";

const moveMedia = [cdnUrl("/Move-1.mp4"), cdnUrl("/Move-2.mp4")];
const refuelMedia = [cdnUrl("/Refuel-1.mp4"), cdnUrl("/refuel-2.jpeg"), cdnUrl("/refuel-3.mp4")];

export function Hero() {
  const { status } = useSession();
  const bookHref = status === "authenticated" ? "/portal/book" : "/login";
  const [moveIndex, setMoveIndex] = useState(0);
  const [refuelIndex, setRefuelIndex] = useState(0);

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
      <section className="relative hidden h-screen w-full overflow-hidden lg:block">
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
                  poster={media.replace(/\.mp4$/, ".poster.jpg")}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
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
                    poster={media.replace(/\.mp4$/, ".poster.jpg")}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover animate-floatAndZoom19"
                  />
                ) : (
                  <Image
                    src={media}
                    alt="Refuel"
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    className="object-cover animate-floatAndZoom19"
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
              poster={cdnUrl("/Connect-1.poster.jpg")}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
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

      {/* Mobile / tablet hero — full-bleed video background (move/refuel/connect
          stacked top→bottom) with the headline + CTAs overlaid (< lg). */}
      <section className="relative min-h-[100svh] w-full overflow-hidden lg:hidden">
        {/* Stacked video panels fill the screen as the background */}
        <div className="absolute inset-0 flex flex-col">
          {[
            { src: moveMedia[0], anim: "animate-floatAndZoom17" },
            { src: refuelMedia[0], anim: "animate-floatAndZoom19" },
            { src: cdnUrl("/Connect-1.mp4"), anim: "animate-floatAndZoom23" },
          ].map((panel) => (
            <div key={panel.src} className="relative flex-1 overflow-hidden">
              <video
                src={panel.src}
                poster={panel.src.replace(/\.mp4$/, ".poster.jpg")}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className={`h-full w-full object-cover ${panel.anim}`}
              />
            </div>
          ))}
        </div>

        {/* Single dark scrim across all panels for headline legibility */}
        <div className="absolute inset-0 bg-black/45" />

        {/* Overlaid content */}
        <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-6 pb-14 pt-24 text-center">
          <h1 className="font-display text-[clamp(2.25rem,8.5vw,3.5rem)] leading-[1.05] text-cream drop-shadow-2xl">
            <span className="italic text-cream/90">We&apos;re more than a studio,</span>
            <br />
            We&apos;re your home away from home
          </h1>

          <p className="mt-4 font-script text-2xl tracking-wider text-cream/90 [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
            move · refuel · connect
          </p>

          <p className="mx-auto mt-3 max-w-md font-body text-base leading-relaxed text-cream/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
            <span className="italic">Move</span> your body, <span className="italic">refuel</span> with a coffee and a smoothie bowl, and find your <span className="italic">community</span>.
          </p>

          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            <Link
              href={bookHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-sage px-6 py-3.5 font-body text-base font-medium text-cream shadow-sm transition-colors hover:bg-sage/90 active:bg-sage/80"
            >
              <Ticket size={18} /> Book a class
            </Link>
            <Link
              href="/classes"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-cream/50 px-6 py-3.5 font-body text-base font-medium text-cream transition-colors hover:bg-cream/10"
            >
              Explore classes
              <ArrowRight size={16} className="motion-reduce:transition-none" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}