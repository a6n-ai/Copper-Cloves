import { useEffect, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { useAuthWeather } from "@/hooks/useAuthWeather";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";
import { SignUpForm } from "@/components/auth/SignUpForm";

type Mode = "signin" | "signup";

/**
 * Single mounted auth surface. The shell (background, top bar, logo) stays put
 * while the form cross-fades between sign-in and sign-up. Switching modes updates
 * the URL via the History API instead of a Next navigation, so the component
 * never remounts (the leaf canvas keeps running, no page flash). A brief splash
 * (logo, centered) plays once on the real page load — i.e. arriving from a public
 * page — then dissolves into the form.
 */
export function AuthExperience({ initialMode }: { initialMode: Mode }) {
  const { palette, weather } = useAuthWeather();
  const [mode, setMode] = useState<Mode>(initialMode);
  const reduce = useReducedMotion();
  const [splash, setSplash] = useState(!reduce);

  useEffect(() => {
    if (!splash) return;
    const t = setTimeout(() => setSplash(false), 1100);
    return () => clearTimeout(t);
  }, [splash]);

  function switchTo(next: Mode) {
    setMode(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", next === "signup" ? "/signup" : "/login");
    }
  }

  return (
    <>
      <AnimatePresence>
        {splash && (
          <m.div
            key="splash"
            className="fixed inset-0 z-50 flex items-center justify-center bg-sage"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <m.div
              className="flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-white.png" alt="The Studio by Copper + Cloves" className="h-auto w-52 sm:w-60" />
              <p className="mt-3 font-body text-[11px] uppercase tracking-[0.35em] text-terracotta">
                by Copper &amp; Cloves
              </p>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      <AuthShell weather={weather} palette={palette}>
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={mode}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
            transition={{ duration: reduce ? 0 : 0.24, ease: "easeOut" }}
          >
            {mode === "signin" ? (
              <SignInForm onSwitchToSignup={() => switchTo("signup")} />
            ) : (
              <SignUpForm onSwitchToSignin={() => switchTo("signin")} />
            )}
          </m.div>
        </AnimatePresence>
      </AuthShell>
    </>
  );
}
