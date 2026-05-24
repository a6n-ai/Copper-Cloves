import { Toaster } from "@/components/ui/toaster";
import "@/styles/globals.css";
import "react-easy-crop/react-easy-crop.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import * as analytics from "@/lib/analytics";
import { CartProvider } from "@/contexts/CartContext";
import { SessionProvider, useSession } from "next-auth/react";
import { useActivityTracking } from "@/hooks/useActivityTracking";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PORTAL_CONFIGS, type PortalKind } from "@/components/dashboard/dashboardNav";

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
  if (pathname.startsWith("/partner") && role === "partner") return "partner";
  if (pathname.startsWith("/instructor") && role === "instructor") return "instructor";
  if (pathname.startsWith("/portal") && role === "user") return "member";
  return null;
}

/** Single chrome for every authenticated dashboard (admin/partner/member/instructor). */
function DashboardChrome({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const user = session?.user as { name?: string; email?: string; role?: string } | undefined;

  const exempt = CHROME_EXEMPT.some((p) => router.pathname.startsWith(p));
  const kind =
    !exempt && status === "authenticated" ? resolvePortalKind(router.pathname, user?.role) : null;

  const [partnerBrand, setPartnerBrand] = useState<{ name: string; logoUrl: string | null } | null>(
    null,
  );
  useEffect(() => {
    if (kind !== "partner") {
      setPartnerBrand(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/partner/profile");
        if (res.ok && !cancelled) {
          const p = await res.json();
          setPartnerBrand({ name: p.name ?? "Partner", logoUrl: p.logo_url ?? null });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  if (!kind) return <>{children}</>;

  const shellUser =
    kind === "partner"
      ? {
          name: partnerBrand?.name ?? "Partner",
          email: user?.email,
          logoUrl: partnerBrand?.logoUrl ?? null,
        }
      : { name: user?.name ?? "Member", email: user?.email };

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

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!router.pathname.startsWith("/portal/")) return;
    if (PORTAL_EXEMPT.some((p) => router.pathname.startsWith(p))) return;
    const user = session?.user as { onboarding_completed?: boolean } | undefined;
    if (user?.onboarding_completed === false) {
      router.replace("/portal/onboarding");
    }
  }, [status, session, router]);

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
    <SessionProvider session={session}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
        <link rel="icon" href={cdnUrl("/favicon.svg")} type="image/svg+xml" />
        <link rel="icon" href={cdnUrl("/favicon.ico")} sizes="any" />
      </Head>
      <ActivityTrackingSubscriber />
      <OnboardingGate />
      <CartProvider>
        <DashboardChrome>
          <Component {...pageProps} />
        </DashboardChrome>
        <Toaster />
      </CartProvider>
    </SessionProvider>
  );
}
