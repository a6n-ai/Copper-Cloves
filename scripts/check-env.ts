/**
 * Environment variable audit.
 *
 * Local:  npm run check:env
 * Amplify: copy this list into AWS Console → Hosting → Environment variables
 *          (or run via custom build step that exits non-zero on missing required vars).
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
config({ path: resolve(process.cwd(), ".env.production"), override: true });

type Severity = "required" | "recommended" | "optional";

interface VarDef {
  name: string;
  severity: Severity;
  group: string;
  hint?: string;
  /** If set, only flag as missing when this predicate returns true. */
  requiredWhen?: () => boolean;
}

const VARS: VarDef[] = [
  // Core
  { name: "STUDIO_DATABASE_URL", severity: "required", group: "Database", hint: "Postgres URL — prefer over DATABASE_URL" },
  { name: "DATABASE_URL", severity: "recommended", group: "Database", hint: "Fallback if STUDIO_DATABASE_URL not set" },
  { name: "NEXTAUTH_URL", severity: "required", group: "Auth", hint: "https://yourdomain — no trailing slash" },
  { name: "NEXTAUTH_SECRET", severity: "required", group: "Auth", hint: "openssl rand -base64 32" },
  // Also the origin every outbound email/QR link is built from — not just auth.
  { name: "BETTER_AUTH_URL", severity: "required", group: "Auth", hint: "https://yourdomain — no trailing slash; must equal APP_DOMAIN" },

  // Razorpay
  { name: "RAZORPAY_KEY_ID", severity: "required", group: "Payments" },
  { name: "RAZORPAY_KEY_SECRET", severity: "required", group: "Payments" },
  { name: "NEXT_PUBLIC_RAZORPAY_KEY_ID", severity: "required", group: "Payments", hint: "Must match RAZORPAY_KEY_ID (client-side)" },
  { name: "RAZORPAY_WEBHOOK_SECRET", severity: "required", group: "Payments", hint: "Configured in Razorpay Dashboard → Webhooks" },

  // Email
  { name: "EMAIL_USER", severity: "required", group: "Email" },
  { name: "EMAIL_PASS", severity: "required", group: "Email", hint: "Gmail App Password" },
  { name: "EMAIL_FROM", severity: "required", group: "Email" },
  { name: "RESEND_API_KEY", severity: "recommended", group: "Email", hint: "Fallback when Gmail SMTP fails" },

  // WhatsApp
  { name: "WHATSAPP_ACCESS_TOKEN", severity: "recommended", group: "WhatsApp" },
  { name: "WHATSAPP_PHONE_NUMBER_ID", severity: "recommended", group: "WhatsApp" },
  { name: "WHATSAPP_PACKAGE_TEMPLATE_NAME", severity: "recommended", group: "WhatsApp" },

  // S3
  { name: "S3_BUCKET", severity: "required", group: "S3" },
  { name: "S3_REGION", severity: "required", group: "S3" },
  { name: "S3_ACCESS_KEY_ID", severity: "required", group: "S3" },
  { name: "S3_SECRET_ACCESS_KEY", severity: "required", group: "S3" },
  { name: "S3_PUBLIC_URL", severity: "optional", group: "S3", hint: "Override bucket public URL" },
  { name: "NEXT_PUBLIC_CDN_URL", severity: "recommended", group: "S3", hint: "CloudFront or public S3 URL for public/ assets" },

  // Cron + bootstrap
  { name: "CRON_SECRET", severity: "recommended", group: "Ops", hint: "For /api/cron/* endpoints" },
  { name: "ADMIN_SETUP_SECRET", severity: "optional", group: "Ops", hint: "Remove after admin bootstrap" },
  { name: "ADMIN_EMAIL", severity: "optional", group: "Ops", hint: "One-time bootstrap only" },
  { name: "ADMIN_PASSWORD", severity: "optional", group: "Ops", hint: "One-time bootstrap only" },

  // Analytics
  { name: "NEXT_PUBLIC_GA_MEASUREMENT_ID", severity: "optional", group: "Analytics" },
];

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function isSet(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

function check() {
  const groups = new Map<string, VarDef[]>();
  for (const v of VARS) {
    if (!groups.has(v.group)) groups.set(v.group, []);
    groups.get(v.group)!.push(v);
  }

  const missing: VarDef[] = [];
  const present: VarDef[] = [];

  console.log(`\n${COLORS.bold}Environment audit${COLORS.reset}`);
  console.log(`${COLORS.dim}Loaded from: .env, .env.local, .env.production (in order)${COLORS.reset}\n`);

  for (const [group, vars] of groups) {
    console.log(`${COLORS.bold}${group}${COLORS.reset}`);
    for (const v of vars) {
      const set = isSet(v.name);
      if (set) {
        present.push(v);
        console.log(`  ${COLORS.green}✓${COLORS.reset} ${v.name}`);
      } else {
        missing.push(v);
        const tag =
          v.severity === "required"
            ? `${COLORS.red}MISSING${COLORS.reset}`
            : v.severity === "recommended"
              ? `${COLORS.yellow}missing${COLORS.reset}`
              : `${COLORS.dim}not set${COLORS.reset}`;
        const hint = v.hint ? ` ${COLORS.dim}— ${v.hint}${COLORS.reset}` : "";
        console.log(`  ${tag === COLORS.red + "MISSING" + COLORS.reset ? COLORS.red + "✗" + COLORS.reset : "○"} ${v.name}  ${tag}${hint}`);
      }
    }
    console.log("");
  }

  // Cross-checks
  const warnings: string[] = [];
  if (isSet("RAZORPAY_KEY_ID") && isSet("NEXT_PUBLIC_RAZORPAY_KEY_ID")) {
    if (process.env.RAZORPAY_KEY_ID?.trim() !== process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim()) {
      warnings.push("RAZORPAY_KEY_ID ≠ NEXT_PUBLIC_RAZORPAY_KEY_ID — client/server key mismatch");
    }
  }
  if (!isSet("STUDIO_DATABASE_URL") && !isSet("DATABASE_URL")) {
    warnings.push("Neither STUDIO_DATABASE_URL nor DATABASE_URL is set — DB queries will fail");
  }
  for (const v of ["NEXTAUTH_URL", "BETTER_AUTH_URL"]) {
    if (process.env[v]?.endsWith("/")) {
      warnings.push(`${v} ends with trailing slash — strip it`);
    }
  }

  const requiredMissing = missing.filter((v) => v.severity === "required");
  const dbMissing = !isSet("STUDIO_DATABASE_URL") && !isSet("DATABASE_URL");
  // Either DB var satisfies the requirement.
  const trueRequiredMissing = requiredMissing.filter(
    (v) => !(v.name === "STUDIO_DATABASE_URL" && !dbMissing) && !(v.name === "DATABASE_URL" && !dbMissing)
  );

  console.log(`${COLORS.bold}Summary${COLORS.reset}`);
  console.log(`  ${COLORS.green}${present.length} set${COLORS.reset}`);
  console.log(`  ${trueRequiredMissing.length > 0 ? COLORS.red : COLORS.dim}${trueRequiredMissing.length} required missing${COLORS.reset}`);
  console.log(`  ${COLORS.yellow}${missing.filter((v) => v.severity === "recommended").length} recommended missing${COLORS.reset}`);
  console.log(`  ${COLORS.dim}${missing.filter((v) => v.severity === "optional").length} optional missing${COLORS.reset}`);

  if (warnings.length > 0) {
    console.log(`\n${COLORS.yellow}${COLORS.bold}Warnings${COLORS.reset}`);
    for (const w of warnings) console.log(`  ${COLORS.yellow}⚠${COLORS.reset} ${w}`);
  }
  console.log("");

  if (trueRequiredMissing.length > 0) {
    console.error(`${COLORS.red}${COLORS.bold}Required vars missing.${COLORS.reset} Add to .env.local (local) or Amplify Console (prod).`);
    process.exit(1);
  }
}

check();
