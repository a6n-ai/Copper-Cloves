import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Build identifier of the currently-deployed server bundle. Polled by the
 * client `BuildVersionWatcher` — when the client-baked build id no longer
 * matches what the server reports, the client soft-reloads so long-idle prod
 * tabs always run the latest JS (and re-handshake the session under the
 * current NEXTAUTH_SECRET).
 *
 * Public + uncacheable on purpose — the whole point is to read live state.
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.status(200).json({
    buildId:
      process.env.NEXT_PUBLIC_BUILD_ID ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.AWS_COMMIT_ID ??
      "dev",
  });
}
