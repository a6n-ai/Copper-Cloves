import { Toaster } from "sonner";
import "@/styles/globals.css";
import "react-easy-crop/react-easy-crop.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import Script from "next/script";
import { Playfair_Display, Montserrat } from "next/font/google";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});
import * as analytics from "@/lib/analytics";
import { CartProvider } from "@/contexts/CartContext";
import { SessionProvider, useSession } from "next-auth/react";
import { useStudioSWR } from "@/lib/swr";
import { getSessionRole, getSessionOnboardingCompleted } from "@/lib/sessionScalars";
import { useActivityTracking } from "@/hooks/useActivityTracking";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PORTAL_CONFIGS, type PortalKind } from "@/components/dashboard/dashboardNav";
import { BuildVersionWatcher } from "@/components/BuildVersionWatcher";

import { cdnUrl } from "@/lib/cdnUrl";

const CHROME_EXEMPT = [
  "/admin/login",
  "/partner/login",
  "/instructor/login",
  "/portal/login",
  "/portal/signup",
  "/portal/onboarding",
  "/portal/payment/razorpay-return",
];

function resolvePortalKind(pathname: string, role?: string): PortalKind | null {
  if (pathname.startsWith("/admin") && role === "admin") return "admin";
  // Chef lives under /admin (café + kitchen) but gets its own scoped chrome.
  if (pathname.startsWith("/admin") && role === "chef") return "kitchen";
  if (pathname.startsWith("/partner") && role === "partner") return "partner";
  if (pathname.startsWith("/instructor") && role === "instructor") return "instructor";
  // /portal is the member area: any authenticated user gets member chrome.
  // Role-specific portals above stay strict (server-guarded); /portal is the
  // shared fallback so non-"user" roles previewing it still get sidebar+topbar.
  if (pathname.startsWith("/portal")) return "member";
  // Unified /account: every signed-in role keeps its own portal chrome here.
  if (pathname === "/account") {
    if (role === "admin") return "admin";
    if (role === "partner") return "partner";
    if (role === "instructor") return "instructor";
    if (role === "chef") return "kitchen";
    return "member";
  }
  return null;
}

/** Single chrome for every authenticated dashboard (admin/partner/member/instructor). */
function DashboardChrome({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  // Pull scalar fields out of `session` once. Every 4-min `refetchInterval`
  // tick produces a fresh `session` object even when the JWT is unchanged;
  // downstream effects/memos key off these primitives instead so they don't
  // re-run on identity churn.
  const userName = session?.user?.name ?? undefined;
  const userEmail = session?.user?.email ?? undefined;
  const userRole = getSessionRole(session);

  const exempt = CHROME_EXEMPT.some((p) => router.pathname.startsWith(p));
  const kind =
    !exempt && status === "authenticated" ? resolvePortalKind(router.pathname, userRole) : null;

  // SWR-shared with any other consumer of `/api/partner/profile` (e.g. the
  // partner settings page) — first paint of either reuses the cached payload.
  const { data: partnerProfile } = useStudioSWR<{ name?: string; logo_url?: string | null }>(
    kind === "partner" ? "/api/partner/profile" : null,
  );
  const partnerBrand = partnerProfile
    ? { name: partnerProfile.name ?? "Partner", logoUrl: partnerProfile.logo_url ?? null }
    : null;

  // Non-partner portals (member/admin/instructor/kitchen) show the user's own
  // uploaded avatar in the topbar + sidebar. SWR-shared with `ProfileSection`
  // so navigating to /account doesn't refetch.
  const { data: userProfile } = useStudioSWR<{ avatar_url?: string | null }>(
    kind && kind !== "partner" ? "/api/user/profile" : null,
  );
  const avatarUrl = userProfile?.avatar_url ?? null;

  // Stabilize the `user` object identity so DashboardShell (and its memoed
  // children) can short-circuit on prop equality. Without this, every 4-min
  // session refetch would cascade a rerender through the whole shell.
  const shellUser = useMemo(
    () =>
      kind === "partner"
        ? {
            name: partnerBrand?.name ?? "Partner",
            email: userEmail,
            logoUrl: partnerBrand?.logoUrl ?? null,
          }
        : { name: userName ?? "Member", email: userEmail, logoUrl: avatarUrl },
    [kind, partnerBrand?.name, partnerBrand?.logoUrl, userName, userEmail, avatarUrl],
  );

  if (!kind) return <>{children}</>;

  return (
    <DashboardShell config={PORTAL_CONFIGS[kind]} user={shellUser}>
      {children}
    </DashboardShell>
  );
}

const PORTAL_EXEMPT = ["/portal/login", "/portal/signup", "/portal/onboarding", "/portal/payment/razorpay-return"];

function OnboardingGate() {
  const { data: session, status } = useSession();
  const router = useRouter();
  // Scalar read so the effect only re-fires when the actual onboarding flag
  // flips — not on every session-refetch tick.
  const onboardingCompleted = getSessionOnboardingCompleted(session);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!router.pathname.startsWith("/portal/")) return;
    if (PORTAL_EXEMPT.some((p) => router.pathname.startsWith(p))) return;
    if (onboardingCompleted === false) {
      router.replace("/portal/onboarding");
    }
  }, [status, onboardingCompleted, router]);

  return null;
}

function ActivityTrackingSubscriber() {
  useActivityTracking();
  return null;
}

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      analytics.pageview(url);
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <SessionProvider
      session={session}
      // Keep the in-memory session fresh against the JWT cookie.
      //  - `refetchInterval`: re-hit /api/auth/session every 4 min so the client
      //    side never drifts more than that from the real JWT state. Prevents
      //    the "UI thinks I'm logged in but API returns 401" gap that users hit
      //    after long-idle prod tabs.
      //  - `refetchOnWindowFocus`: snap fresh the moment the tab regains focus
      //    (e.g. after waking the laptop), so the next admin click can't 401.
      //  - `refetchWhenOffline: false`: don't burn cycles when the network is
      //    down — we'll re-validate the moment it returns.
      refetchInterval={4 * 60}
      refetchOnWindowFocus
      refetchWhenOffline={false}
    >
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
        <link rel="icon" href={cdnUrl("/favicon.svg")} type="image/svg+xml" />
        <link rel="icon" href={cdnUrl("/favicon.ico")} sizes="any" />
      </Head>
      <style jsx global>{`
        :root {
          --font-playfair: ${playfair.style.fontFamily};
          --font-montserrat: ${montserrat.style.fontFamily};
        }
      `}</style>

      {/* GA loaded after interactive so it doesn't block first paint. */}
      {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}

      {/*
        CRITICAL: DO NOT REMOVE THIS SCRIPT
        The Softgen AI monitoring script is essential for core app functionality.
        Loaded lazily so it doesn't compete with first paint.
      */}
      <Script
        src="https://cdn.softgen.ai/script.js"
        strategy="lazyOnload"
        data-softgen-monitoring="true"
      />

      <div className={`${playfair.variable} ${montserrat.variable}`}>
        <BuildVersionWatcher />
        <ActivityTrackingSubscriber />
        <OnboardingGate />
        <CartProvider>
          <DashboardChrome>
            <Component {...pageProps} />
          </DashboardChrome>
          <Toaster richColors closeButton position="top-center" />
        </CartProvider>
      </div>
    </SessionProvider>
  );
}
