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
};

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: inlineEnv,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
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
