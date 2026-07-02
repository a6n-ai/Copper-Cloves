import type { ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { AuthLeavesBackground } from "@/components/AuthLeavesBackground";
import { WeatherWidget } from "@/components/WeatherWidget";
import { quirkyWeatherLine } from "@/lib/weatherCopy";
import type { MeshPalette } from "@/lib/weatherPalette";
import type { AuthWeather } from "@/hooks/useAuthWeather";

/**
 * Persistent chrome for the auth experience (sign in / sign up). The background,
 * top bar, weather line, brand header and quote stay mounted while only the
 * `children` (the mode-specific form) cross-fades — so switching modes never
 * feels like a page reload.
 */
export function AuthShell({
  weather,
  palette,
  children,
}: {
  weather: AuthWeather | null;
  palette: MeshPalette;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-cream p-4 py-10 sm:p-6">
      <AuthLeavesBackground palette={palette} />

      {/* Top bar: weather + back home */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-5 sm:p-6">
        <WeatherWidget weather={weather} />
        <Link href="/" className="font-body text-sm text-charcoal/70 hover:text-sage transition-colors">← Home</Link>
      </div>

      {/* Centered card */}
      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.5, ease: "easeOut" }}
      >
        {weather && (
          <p className="mb-6 text-center font-body text-sm sm:text-base font-medium text-charcoal/85 leading-relaxed [text-shadow:0_1px_10px_rgba(255,255,255,0.85)]">
            {quirkyWeatherLine(weather.condition, weather.tempC, weather.city)}
          </p>
        )}

        <div className="relative isolate overflow-hidden rounded-3xl border border-border bg-white-warm shadow-[0_4px_24px_rgba(51,51,51,0.08)] p-8 sm:p-10">
          {/* Brand header — shared across modes */}
          <div>
            <p className="mb-4 text-center font-body text-[10px] tracking-[0.4em] uppercase text-terracotta/80">
              Vegan · Wellness · Café
            </p>
            <div className="mb-5 text-center">
              <span className="font-display text-2xl text-charcoal italic tracking-tight">
                the<span className="font-normal not-italic uppercase tracking-[0.15em]">STUDIO</span>
              </span>
              <p className="font-body text-[10px] tracking-[0.35em] uppercase text-charcoal/70 mt-1">by Copper + Cloves</p>
            </div>
          </div>

          {children}
        </div>

        {/* Quote below the card */}
        {weather?.quote && (
          <motion.div
            className="mx-auto mt-6 max-w-sm px-2 text-center [text-shadow:0_1px_8px_rgba(255,255,255,0.75)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.25 }}
          >
            <figure>
              <blockquote className="font-display text-base italic text-charcoal leading-snug">
                “{weather.quote.text}”
              </blockquote>
              <figcaption className="font-body text-[11px] uppercase tracking-widest text-charcoal/70 mt-1.5">
                — {weather.quote.author}
              </figcaption>
            </figure>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
