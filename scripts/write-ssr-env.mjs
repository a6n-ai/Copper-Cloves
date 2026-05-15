/**
 * Writes .env.production for Amplify SSR so Next.js API routes load DB + NextAuth vars.
 * Values are JSON-stringified per line so special characters (#, $, spaces) in secrets/URLs
 * are not mangled by dotenv (unlike raw `env | grep >> .env.production`).
 */
import fs from "node:fs";

const KEYS = [
  "STUDIO_DATABASE_URL",
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  // Optional: public site URL for links in CRM templates if NEXTAUTH_URL is wrong for some routes
  "NEXT_PUBLIC_SITE_URL",
  // Optional: POST /api/setup/bootstrap-admin once, then remove from Amplify.
  "ADMIN_SETUP_SECRET",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  // Email: Gmail SMTP (EMAIL_USER + EMAIL_PASS app password) preferred when set; else Resend.
  "EMAIL_USER",
  "EMAIL_PASS",
  "EMAIL_FROM",
  "RESEND_API_KEY",
  // WhatsApp / other notifications (optional)
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_PACKAGE_TEMPLATE_NAME",
  "WHATSAPP_TEMPLATE_LANGUAGE",
  "WHATSAPP_TEMPLATE_BODY_VARIABLES",
  "WHATSAPP_DEFAULT_COUNTRY_CODE",
  "WHATSAPP_API_VERSION",
  // Razorpay (optional — add in Amplify for payments)
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "NEXT_PUBLIC_RAZORPAY_KEY_ID",
];

const hasDb =
  Boolean(process.env.STUDIO_DATABASE_URL?.trim()) || Boolean(process.env.DATABASE_URL?.trim());
if (!hasDb) {
  console.error("ERROR: Set STUDIO_DATABASE_URL or DATABASE_URL in Amplify environment variables.");
  process.exit(1);
}

let out = "";

for (const k of KEYS) {
  const v = process.env[k];
  // DB URLs are passed through unchanged; `src/lib/prisma.ts` normalizes TLS for RDS at runtime.

  if (v != null && String(v).length > 0) {
    out += `${k}=${JSON.stringify(String(v))}\n`;
  }
}

fs.writeFileSync(".env.production", out);
console.log("Wrote .env.production for SSR (values not printed).");
