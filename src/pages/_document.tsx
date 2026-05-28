import { cn } from "@/lib/utils";
import { Html, Head, Main, NextScript } from "next/document";
import { SEOElements } from "@/components/SEO";

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
      </Head>
      <body
        className={cn(
          "min-h-screen w-full scroll-smooth bg-background text-foreground antialiased"
        )}
      >
        <Main />
        <NextScript />

        {/* Visual Editor Script */}
        {process.env.NODE_ENV === "development" && (
          <script
            src="https://cdn.softgen.dev/visual-editor.min.js"
            async
            data-softgen-visual-editor="true"
          />
        )}
      </body>
    </Html>
  );
}
