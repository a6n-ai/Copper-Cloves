import type { ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { WeatherWidget } from "@/components/WeatherWidget";
import { quirkyWeatherLine } from "@/lib/weatherCopy";
import type { MeshPalette } from "@/lib/weatherPalette";
import type { AuthWeather } from "@/hooks/useAuthWeather";

/**
 * Persistent chrome for the auth experience (sign in / sign up). Revolut-style:
 * a boxless form floating on the live grainient background, branding lives in
 * the top-left logo, and a right-hand panel carries the weather line + widget.
 * Background + chrome stay mounted while only the `children` (the mode-specific
 * form) cross-fades.
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
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-y-auto bg-cream p-4 py-20 sm:p-6 sm:py-16">
      {/* Constant brand field — soft creamy sage, never changes with weather. */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(160deg,#eef0e6_0%,#e4e8d7_60%,#dde2cf_100%)]" aria-hidden />
      {/* Only this bloom (top-left, at the logo) tracks weather + time of day. */}
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-[background] duration-700"
        aria-hidden
        style={{
          background: `radial-gradient(70% 75% at 16% 16%, ${palette.c1}, transparent 72%), radial-gradient(52% 58% at 6% 8%, ${palette.c2}, transparent 64%), radial-gradient(44% 50% at 26% 30%, ${palette.c3}, transparent 58%)`,
        }}
      />

      {/* Top bar: mobile logo (center) · home (right) */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 p-5 sm:p-6">
        <div className="flex-1" />
        <Link href="/" aria-label="The Studio — home" className="shrink-0 sm:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="The Studio" className="h-7 w-auto" style={{ filter: "brightness(0)" }} />
        </Link>
        <div className="flex flex-1 justify-end">
          <Link href="/" className="min-h-11 inline-flex items-center font-body text-sm text-charcoal/70 hover:text-sage transition-colors">← Home</Link>
        </div>
      </div>

      {/* Desktop logo — top-left of the stage (the gradient's focal point) */}
      <Link href="/" aria-label="The Studio — home" className="absolute left-8 top-8 z-20 hidden sm:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.png" alt="The Studio" className="h-9 w-auto" style={{ filter: "brightness(0)" }} />
      </Link>

      {/* Floating form (left) + weather panel (right, desktop only — like the ref's QR) */}
      <div className="relative z-10 flex w-full max-w-4xl items-center justify-center gap-12 lg:gap-20">
        <motion.div
          className="w-full max-w-md"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.5, ease: "easeOut" }}
        >
          {children}
        </motion.div>

        {weather && (
          <motion.aside
            className="hidden max-w-xs shrink-0 border-l border-charcoal/12 pl-12 lg:block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.25 }}
          >
            <p className="font-display text-2xl italic text-charcoal leading-snug [text-shadow:0_1px_8px_rgba(255,255,255,0.6)]">
              {quirkyWeatherLine(weather.condition, weather.tempC, weather.city)}
            </p>
            <div className="mt-6">
              <WeatherWidget weather={weather} />
            </div>
          </motion.aside>
        )}
      </div>

      {/* Privacy policy — bottom-left */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex justify-start p-5 sm:p-6">
        <Link href="/policy" className="font-body text-xs text-charcoal/60 hover:text-sage transition-colors">
          Privacy Policy
        </Link>
      </div>
    </div>
  );
}
