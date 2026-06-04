import { cn } from "@/lib/utils";
import { Html, Head, Main, NextScript } from "next/document";
import { SEOElements } from "@/components/SEO";

// Origin of the asset CDN (CloudFront / S3) every avatar + image loads from.
// Preconnecting shaves the TLS handshake off the first authenticated paint.
const CDN_ORIGIN = (() => {
  const raw = process.env.NEXT_PUBLIC_CDN_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
})();

// GA + Softgen moved into _app.tsx via `next/script` so they can use
// `afterInteractive` / `lazyOnload` strategies (only `beforeInteractive` is
// allowed inside _document, which would block the main thread on first paint).

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <SEOElements />

        {/* Speeds up first connect to the third-party origins we load assets
            from. Cheap to add; doesn't fire actual requests. */}
        <link rel="preconnect" href="https://checkout.razorpay.com" />
        <link rel="dns-prefetch" href="https://checkout.razorpay.com" />
        {CDN_ORIGIN && (
          <>
            <link rel="preconnect" href={CDN_ORIGIN} crossOrigin="" />
            <link rel="dns-prefetch" href={CDN_ORIGIN} />
          </>
        )}
      </Head>
      <body
        className={cn(
          "min-h-screen w-full scroll-smooth bg-background text-foreground antialiased"
        )}
      >
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
