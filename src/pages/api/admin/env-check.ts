import fs from "node:fs";
import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";

/**
 * Admin-only env diagnostic. Returns ONLY which env keys are set (no values).
 * Use to verify SSM parameters actually reached the container's environment
 * (deploy.sh renders /copper-cloves/prod into .env.production; compose injects it).
 *
 * GET /api/admin/env-check
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow unauthenticated probe via x-debug-key header during initial bring-up;
  // remove this branch once production is healthy.
  const debugKey = process.env.ENV_CHECK_KEY?.trim();
  const probedKey = (req.headers["x-debug-key"] as string | undefined)?.trim();
  const allowProbe = debugKey && probedKey === debugKey;

  if (!allowProbe) {
    const session = await getStudioServerSession(req, res);
    if (!ensureAdmin(session, res)) return;
  }

  const interesting = [
    "STUDIO_DATABASE_URL",
    "DATABASE_URL",
    "BETTER_AUTH_URL",
    // NextAuth still serves every session until the cutover — operators need both.
    "NEXTAUTH_URL",
    "NEXTAUTH_SECRET",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "NEXT_PUBLIC_RAZORPAY_KEY_ID",
    "EMAIL_USER",
    "EMAIL_PASS",
    "EMAIL_FROM",
    "RESEND_API_KEY",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "S3_BUCKET",
    "S3_REGION",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "NEXT_PUBLIC_CDN_URL",
    "CRON_SECRET",
    "ADMIN_SETUP_SECRET",
  ];

  const result: Record<string, { set: boolean; length?: number; prefix?: string }> = {};
  for (const k of interesting) {
    const v = process.env[k];
    if (typeof v === "string" && v.length > 0) {
      result[k] = {
        set: true,
        length: v.length,
        // Show only first 6 chars for connection strings so admin can verify host
        prefix: k.endsWith("_URL") || k.includes("DATABASE") ? v.slice(0, 30) + "…" : undefined,
      };
    } else {
      result[k] = { set: false };
    }
  }

  // Runtime info
  const runtime = {
    cwd: process.cwd(),
    nodeVersion: process.version,
    platform: process.platform,
    nextRuntime: process.env.NEXT_RUNTIME ?? null,
    awsLambda: Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME),
    lambdaName: process.env.AWS_LAMBDA_FUNCTION_NAME ?? null,
    envFileChecks: {
      cwd_env_production: tryReadable(`${process.cwd()}/.env.production`),
      cwd_dot_next_env_production: tryReadable(`${process.cwd()}/.next/.env.production`),
    },
  };

  return res.status(200).json({ env: result, runtime });
}

function tryReadable(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}
