/** @type {import('next').NextConfig} */
// Amplify Hosting (Compute) does NOT inject Console environment variables into
// the SSR Lambda runtime — they are only available at build time. To make
// server-side code (Prisma, NextAuth, Razorpay, etc.) see them at runtime we
// inline build-time values into the bundle via `env`.
// Ref: https://github.com/prisma/prisma/discussions/20116
const inlineEnv = {
  STUDIO_DATABASE_URL: process.env.STUDIO_DATABASE_URL ?? "",
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "",
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "",
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ?? "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ?? "",
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  EMAIL_USER: process.env.EMAIL_USER ?? "",
  EMAIL_PASS: process.env.EMAIL_PASS ?? "",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  WHATSAPP_PACKAGE_TEMPLATE_NAME: process.env.WHATSAPP_PACKAGE_TEMPLATE_NAME ?? "",
  WHATSAPP_TEMPLATE_LANGUAGE: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "",
  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION ?? "",
  S3_BUCKET: process.env.S3_BUCKET ?? "",
  S3_REGION: process.env.S3_REGION ?? "",
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "",
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "",
  S3_PUBLIC_URL: process.env.S3_PUBLIC_URL ?? "",
  CRON_SECRET: process.env.CRON_SECRET ?? "",
  ADMIN_SETUP_SECRET: process.env.ADMIN_SETUP_SECRET ?? "",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "",
  ENV_CHECK_KEY: process.env.ENV_CHECK_KEY ?? "",
  // Build identifier exposed to the client. The BuildVersionWatcher component
  // polls /api/version against this value; mismatch triggers a soft reload so
  // long-idle prod tabs always pick up the latest bundle (and a fresh session
  // signed by the current NEXTAUTH_SECRET) instead of 401-looping.
  NEXT_PUBLIC_BUILD_ID:
    process.env.NEXT_PUBLIC_BUILD_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.AWS_COMMIT_ID ??
    String(Date.now()),
};

// Only inline secrets on Amplify — Amplify SSR Lambdas don't get Console env
// vars injected at runtime, so we bake them in at build time. On Vercel and
// local dev, runtime env works correctly; inlining is a security liability.
const IS_AMPLIFY = Boolean(process.env.AWS_APP_ID || process.env.AWS_BRANCH);

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: IS_AMPLIFY ? inlineEnv : {},
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
  // Stable build id per deploy → matches NEXT_PUBLIC_BUILD_ID above so client
  // and server agree on which bundle is current.
  generateBuildId: async () =>
    process.env.NEXT_PUBLIC_BUILD_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.AWS_COMMIT_ID ??
    String(Date.now()),
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
    ];
  },
};

export default nextConfig;
