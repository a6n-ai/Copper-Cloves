/**
 * Cron job health (admin). Surfaces the durable `cron_runs` records so a green
 * GitHub Actions tick can be checked against what the job ACTUALLY did.
 *
 *  GET → { jobs: [{ job, lastRun, lastOk }], recent: [...] }
 *    lastRun = most recent run of that job (any status)
 *    lastOk  = most recent successful run (for "last time it actually worked")
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";

const KNOWN_JOBS = ["class-emails", "reconcile-no-shows", "lifecycle-bookings", "reconcile-razorpay"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;
  if (req.method !== "GET") return res.status(405).end();

  const jobs = await Promise.all(
    KNOWN_JOBS.map(async (job) => {
      const [lastRun, lastOk] = await Promise.all([
        prisma.cronRun.findFirst({ where: { job }, orderBy: { started_at: "desc" } }),
        prisma.cronRun.findFirst({ where: { job, status: "ok" }, orderBy: { started_at: "desc" } }),
      ]);
      return { job, lastRun, lastOk };
    }),
  );

  const recent = await prisma.cronRun.findMany({ orderBy: { started_at: "desc" }, take: 30 });

  return res.json({ jobs, recent });
}
