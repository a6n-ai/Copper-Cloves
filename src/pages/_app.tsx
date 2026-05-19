import { Toaster } from "@/components/ui/toaster";
import "@/styles/globals.css";
import "react-easy-crop/react-easy-crop.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect } from "react";
import * as analytics from "@/lib/analytics";
import { CartProvider } from "@/contexts/CartContext";
import { SessionProvider, useSession } from "next-auth/react";
import { useActivityTracking } from "@/hooks/useActivityTracking";
import { AdminNavigation } from "@/components/AdminNavigation";

const ADMIN_CHROME_EXEMPT = ["/admin/login"];

function AdminChrome({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdminRoute =
    router.pathname.startsWith("/admin") &&
    !ADMIN_CHROME_EXEMPT.some((p) => router.pathname.startsWith(p));
  const user = session?.user as { name?: string; email?: string; role?: string } | undefined;
  const show = isAdminRoute && status === "authenticated" && user?.role === "admin";
  if (!show) return <>{children}</>;
  return (
    <AdminNavigation adminName={user?.name ?? "Admin"} adminEmail={user?.email ?? ""}>
      {children}
    </AdminNavigation>
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
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </Head>
      <ActivityTrackingSubscriber />
      <OnboardingGate />
      <CartProvider>
        <AdminChrome>
          <Component {...pageProps} />
        </AdminChrome>
        <Toaster />
      </CartProvider>
    </SessionProvider>
  );
}
