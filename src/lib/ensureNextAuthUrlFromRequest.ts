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
    return;
  }

  /* Local dev: `.env.local` often has port 3000 while Next picks 3001 when 3000 is busy. */
  if (process.env.NODE_ENV === "development") {
    try {
      const configured = new URL(current);
      const request = new URL(derived);
      const local =
        configured.hostname === "localhost" ||
        configured.hostname === "127.0.0.1";
      if (local && request.hostname === configured.hostname && configured.origin !== request.origin) {
        process.env.NEXTAUTH_URL = derived;
        return;
      }
    } catch {
      process.env.NEXTAUTH_URL = derived;
      return;
    }
  }

  /*
   * Amplify preview branches use a different hostname than `main.*.amplifyapp.com`, but env often
   * only sets NEXTAUTH_URL for production. Misaligned URLs break server-side `getServerSession` in
   * API routes even when the browser session looks fine.
   */
  try {
    const requestHost = host.split(":")[0].toLowerCase();
    const configuredHost = new URL(current).hostname.toLowerCase();
    if (
      requestHost.endsWith(".amplifyapp.com") &&
      configuredHost !== requestHost
    ) {
      process.env.NEXTAUTH_URL = derived;
    }
  } catch {
    process.env.NEXTAUTH_URL = derived;
  }
}
