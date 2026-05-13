import type { NextApiRequest } from "next";

const PLACEHOLDER_HOST_IN_URL = /d1a2b3c4e5|xxxxx|YOUR_|your-app\.|example\.amplifyapp/i;

/**
 * NextAuth uses NEXTAUTH_URL for CSRF and callback URLs. Amplify often mis-copies a doc
 * placeholder (e.g. main.d1a2b3c4e5.amplifyapp.com). Derive the canonical URL from the
 * incoming request when the env value is missing or clearly a placeholder.
 */
export function ensureNextAuthUrlFromRequest(req: NextApiRequest): void {
  const rawHost = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
  if (!host || typeof host !== "string") return;

  const rawProto = req.headers["x-forwarded-proto"];
  const protoHead = Array.isArray(rawProto) ? rawProto[0] : rawProto;
  const proto = protoHead === "http" ? "http" : "https";

  const derived = `${proto}://${host}`;
  const current = process.env.NEXTAUTH_URL?.trim() ?? "";

  if (!current || PLACEHOLDER_HOST_IN_URL.test(current)) {
    process.env.NEXTAUTH_URL = derived;
  }
}
