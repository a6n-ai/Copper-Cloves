import { useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { useAuthWeather } from "@/hooks/useAuthWeather";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";
import { SignUpForm } from "@/components/auth/SignUpForm";

type Mode = "signin" | "signup";

/**
 * Single mounted auth surface. The shell (background, header, weather, quote)
 * stays put while the form cross-fades between sign-in and sign-up. Switching
 * modes updates the URL via the History API instead of a Next navigation, so
 * the component never remounts (the leaf canvas keeps running, no page flash).
 */
export function AuthExperience({ initialMode }: { initialMode: Mode }) {
  const { palette, weather } = useAuthWeather();
  const [mode, setMode] = useState<Mode>(initialMode);
  const reduce = useReducedMotion();

  function switchTo(next: Mode) {
    setMode(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", next === "signup" ? "/signup" : "/login");
    }
  }

  return (
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
  );
}
