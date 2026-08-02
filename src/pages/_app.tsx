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
import { useSession } from "@/lib/auth/client";
import { useStudioSWR } from "@/lib/swr";
import { hasRole, primaryRole } from "@/lib/auth/roles";
import { useActivityTracking } from "@/hooks/useActivityTracking";
import dynamic from "next/dynamic";
// Dashboard chrome (cmdk/Command, sidebar, radix dropdown/popover)
// only ever renders for authenticated portal routes (kind !== null). Loading it
// via next/dynamic splits it into its own chunk so public marketing pages — the
// bulk of first-load traffic — never download it. SSR stays on (default) so the
// authed pages still server-render the shell.
const DashboardShell = dynamic(
  () => import("@/components/dashboard/DashboardShell").then((m) => m.DashboardShell),
  { ssr: true },
);
import { PORTAL_CONFIGS, type PortalKind } from "@/components/dashboard/dashboardNav";
import { BuildVersionWatcher } from "@/components/BuildVersionWatcher";
import { GeoCapture } from "@/components/analytics/GeoCapture";
import { GlassNavigation } from "@/components/GlassNavigation";
import { PublicMobileNav } from "@/components/PublicMobileNav";
import { PageTransition } from "@/components/transitions/PageTransition";
import { RouteProgress } from "@/components/transitions/RouteProgress";
import { isPublicSite, PUBLIC_NAV_ROUTES } from "@/lib/isPublicSite";
import { PageLoader } from "@/components/ui/spinner";

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

// Unified /account: every signed-in role keeps its own portal chrome here.
const ACCOUNT_KIND_BY_ROLE: Record<string, PortalKind> = {
  admin: "admin",
  partner: "partner",
  instructor: "instructor",
  chef: "kitchen",
};
function accountPortalKind(role?: string): PortalKind {
  return (role && ACCOUNT_KIND_BY_ROLE[role]) || "member";
}

// `rawRole` is the raw (possibly comma-separated multi-role) session string —
// each portal path is checked with `hasRole` so a multi-role identity (e.g.
// "admin,partner") gets the right chrome regardless of which of their roles
// is highest-privilege. Only the `/account` fallback needs a single value
// (which portal is "home"), so that path resolves the primary role instead.
function resolvePortalKind(pathname: string, rawRole?: string): PortalKind | null {
  if (pathname.startsWith("/admin") && hasRole(rawRole, "admin")) return "admin";
  // Chef lives under /admin (café + kitchen) but gets its own scoped chrome.
  if (pathname.startsWith("/admin") && hasRole(rawRole, "chef")) return "kitchen";
  if (pathname.startsWith("/partner") && hasRole(rawRole, "partner")) return "partner";
  if (pathname.startsWith("/instructor") && hasRole(rawRole, "instructor")) return "instructor";
  // /portal is the member area: any authenticated user gets member chrome.
  // Role-specific portals above stay strict (server-guarded); /portal is the
  // shared fallback so non-"user" roles previewing it still get sidebar+topbar.
  if (pathname.startsWith("/portal")) return "member";
  if (pathname === "/account") return accountPortalKind(primaryRole(rawRole));
  return null;
}

/** Single chrome for every authenticated dashboard (admin/partner/member/instructor). */
function DashboardChrome({ children }: Readonly<{ children: React.ReactNode }>) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  // The shell decision depends on whether we have a session, which is unresolved
  // on the client's first paint but resolved on the server — branching the tree
  // on it directly causes a hydration mismatch. Defer the shell to after mount
  // so SSR and the first client render agree; the shell then appears once hydrated.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Pull scalar fields out of `session` once. Every session-refetch tick
  // produces a fresh `session` object even when the JWT is unchanged;
  // downstream effects/memos key off these primitives instead so they don't
  // re-run on identity churn.
  const userName = session?.user?.name ?? undefined;
  const userEmail = session?.user?.email ?? undefined;
  const rawRole = (session?.user as { role?: string } | undefined)?.role;

  const exempt = CHROME_EXEMPT.some((p) => router.pathname.startsWith(p));
  const kind =
    mounted && !exempt && !!session?.user
      ? resolvePortalKind(router.pathname, rawRole)
      : null;

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

  // Better Auth's session atom starts empty and fetches on mount (no more
  // SSR-provided `pageProps.session`), so `isPending` is briefly true on every
  // dashboard-route navigation. Without this, `kind` resolves to null and the
  // shell-less `children` branch below flashes before the sidebar/topbar pop
  // in. Route-shape guess only (role-agnostic) — it can't mis-render the wrong
  // portal's chrome, just avoid a blank flash while the real session resolves.
  const looksLikeDashboardRoute =
    !exempt &&
    (router.pathname.startsWith("/admin") ||
      router.pathname.startsWith("/partner") ||
      router.pathname.startsWith("/instructor") ||
      router.pathname.startsWith("/portal") ||
      router.pathname === "/account");
  if (mounted && isPending && looksLikeDashboardRoute) return <PageLoader />;

  if (!kind) return <>{children}</>;

  return (
    <DashboardShell config={PORTAL_CONFIGS[kind]} user={shellUser}>
      {children}
    </DashboardShell>
  );
}

/**
 * Public marketing chrome. Dashboards are handled by DashboardChrome above, so
 * here we only act on public routes: the shared <Navigation> is mounted ONCE
 * (outside the transition) so it stays put across route changes, and the page
 * body fades/lifts via PageTransition. Routes without a nav entry render just
 * the transition (login, signup, meal-subscription, checkin, 404).
 */
function PublicChrome({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  if (!isPublicSite(router.pathname)) return <>{children}</>;
  const variant = PUBLIC_NAV_ROUTES[router.pathname];
  // Cream backdrop sits BELOW the transition wrapper (it never fades), so the
  // crossfade gap reveals the site's cream — not the white document background.
  return (
    <div className={`min-h-screen bg-cream${variant ? " pb-[76px] md:pb-0" : ""}`}>
      {variant && <GlassNavigation variant={variant} />}
      <PageTransition>{children}</PageTransition>
      {variant && <PublicMobileNav />}
    </div>
  );
}

const PORTAL_EXEMPT = ["/portal/login", "/portal/signup", "/portal/onboarding", "/portal/payment/razorpay-return"];

function OnboardingGate() {
  const { data: session } = useSession();
  const router = useRouter();
  // Client session shape (better-auth's customSession) puts onboarding_completed
  // at the TOP LEVEL, not on `session.user` — unlike the server's StudioSession,
  // which getStudioServerSession flattens onto `user` for ~40 API routes.
  // getSessionOnboardingCompleted (sessionScalars.ts) reads the server shape and
  // is always undefined here — read the client shape directly instead.
  const onboardingCompleted = session?.onboarding_completed;

  useEffect(() => {
    if (!session?.user) return;
    if (!router.pathname.startsWith("/portal/")) return;
    if (PORTAL_EXEMPT.some((p) => router.pathname.startsWith(p))) return;
    if (onboardingCompleted === false) {
      router.replace("/portal/onboarding");
    }
  }, [session, onboardingCompleted, router]);

  return null;
}

function ActivityTrackingSubscriber() {
  useActivityTracking();
  return null;
}

export default function App({ Component, pageProps }: AppProps) {
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
    <>
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

      <div className={`${playfair.variable} ${montserrat.variable}`}>
        <BuildVersionWatcher />
        <GeoCapture />
        <ActivityTrackingSubscriber />
        <OnboardingGate />
        <RouteProgress />
        <CartProvider>
          <DashboardChrome>
            <PublicChrome>
              <Component {...pageProps} />
            </PublicChrome>
          </DashboardChrome>
          <Toaster richColors closeButton position="top-center" />
        </CartProvider>
      </div>
    </>
  );
}
