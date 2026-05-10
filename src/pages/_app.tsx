import { Toaster } from "@/components/ui/toaster";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import * as analytics from "@/lib/analytics";
import { CartProvider } from "@/contexts/CartContext";
import { SessionProvider } from "next-auth/react";
import { useActivityTracking } from "@/hooks/useActivityTracking";

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
      <ActivityTrackingSubscriber />
      <CartProvider>
        <Component {...pageProps} />
        <Toaster />
      </CartProvider>
    </SessionProvider>
  );
}
