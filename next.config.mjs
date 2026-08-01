/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emit a self-contained server bundle (server.js + only the traced
  // node_modules) so the Docker runner stage needs no `npm install`.
  output: "standalone",
  // Without this, Next INFERS the trace root by walking up for a lockfile — and
  // a stray package-lock.json anywhere above the repo (a home directory, say)
  // silently makes it the root, nesting the output at
  // `.next/standalone/<path>/<to>/<repo>/server.js`. deployment/Dockerfile copies
  // `.next/standalone` to /app and runs `node server.js`, so that nesting is a
  // crash loop. Pin it to this file's directory and the layout is identical
  // everywhere.
  outputFileTracingRoot: import.meta.dirname,
  // Transform barrel imports (`import { X } from "lucide-react"`) into direct
  // per-module imports so only the icons/charts actually used land in the
  // bundle. Without listing them here Next does NOT auto-optimize these — the
  // app barrel-imports lucide-react in 100+ files.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "framer-motion",
      "@radix-ui/react-icons",
    ],
  },
  // The invoice PDF route reads the bundled brand fonts from `public/fonts` at
  // runtime via `path.join(process.cwd(), "public/fonts", …)`. Files under
  // `public/` are CDN-served and are NOT auto-traced into the SSR/serverless
  // function, so on Vercel/Lambda they'd be missing and every invoice download
  // would 500. Force them into the function's file trace.
  outputFileTracingIncludes: {
    "/api/bookings/[id]/invoice": ["./public/fonts/**"],
  },
  // Stable build id per deploy → matches NEXT_PUBLIC_BUILD_ID above so client
  // and server agree on which bundle is current.
  // CI passes the commit SHA as the BUILD_ID build-arg (see deployment/Dockerfile),
  // which becomes NEXT_PUBLIC_BUILD_ID. BuildVersionWatcher polls /api/version
  // against it so long-idle prod tabs soft-reload onto the current bundle instead
  // of 401-looping against a session signed by a rotated NEXTAUTH_SECRET.
  generateBuildId: async () => process.env.NEXT_PUBLIC_BUILD_ID ?? String(Date.now()),
  // Guards re-enabled: the codebase is lint-clean (0 warnings) and tsc-clean,
  // so let builds fail on regressions instead of silently shipping them.
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Explicit allowlist of <Image quality> values used across the app
    // (75 default + 85/88/90/95 in use). Required starting Next.js 16 —
    // unlisted qualities log a warning now and will 400 later.
    qualities: [75, 85, 88, 90, 95],
    // CDN-cache optimized variants for a year; image URLs are content-addressed
    // by S3 key so a new upload changes the URL.
    minimumCacheTTL: 31536000,
    // Explicit allowlist (was `**`). Tightens the optimizer's cache-key space
    // and shrinks the attack surface for hostname-spoofing payloads.
    //
    // Admin-pasted arbitrary URLs (instructor avatars, member avatars, partner
    // logos, product/cafe images uploaded via the in-app cropper) always go
    // through S3 and so match `*.amazonaws.com`. The few sites that accept
    // truly external URLs (admin pastes a Cloudinary link, etc.) are wrapped
    // in `<Image unoptimized>` which bypasses this allowlist entirely.
    // NOTE: if `NEXT_PUBLIC_CDN_URL` points at a custom domain (e.g.
    // `cdn.copperandcloves.com`) rather than a raw `*.cloudfront.net` URL,
    // add it explicitly here or the optimizer will 400 those requests.
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/founder",
        destination: "/story",
        permanent: true,
      },
    ];
  },
  async headers() {
    // Per-user / role-scoped endpoints that must NEVER be shared-cached. A CDN
    // keying only on path would otherwise serve one user's identity/data (and,
    // for /api/auth, their session cookie) to another — the account-takeover
    // bleed. The public, cacheable routes (packages/classes/retail-products/
    // cafe items) are deliberately NOT listed here; they set their own
    // `public` Cache-Control at runtime. Each prefix is matched both bare and
    // with sub-paths.
    const noStore = { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" };
    const varyCookie = { key: "Vary", value: "Cookie" };
    const privatePrefixes = [
      "/api/auth",
      "/api/user",
      "/api/admin",
      "/api/instructor",
      "/api/partner",
      "/api/bookings",
      "/api/user-packages",
      "/api/user-stats",
    ];
    const privateHeaderRules = privatePrefixes.flatMap((p) => [
      { source: p, headers: [noStore, varyCookie] },
      { source: `${p}/:path*`, headers: [noStore, varyCookie] },
    ]);

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      ...privateHeaderRules,
    ];
  },
};

export default nextConfig;
