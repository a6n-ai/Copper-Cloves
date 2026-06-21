import type { NextApiRequest } from "next";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { resolveAction, buildActivityDetails } from "./actions";

export interface LogActivityActor {
  id?: string | null;
  role?: string | null;
  name?: string | null;
}

export interface LogActivityOpts {
  /** Request — used for ip/user-agent and (when actor omitted) session fallback. */
  req?: NextApiRequest;
  /** Registry key, e.g. "booking.created". */
  action: string;
  /** Explicit actor (required for pre-session flows like signup/login). */
  actor?: LogActivityActor;
  /** Whose account this affects. Defaults to the resolved actor id. */
  targetProfileId?: string | null;
  entity?: { type: string; id: string };
  metadata?: Record<string, unknown>;
}

function clientIp(req?: NextApiRequest): string | null {
  if (!req) return null;
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string") return xf.split(",")[0]?.trim() || null;
  if (Array.isArray(xf)) return xf[0] || null;
  return req.socket?.remoteAddress ?? null;
}

/**
 * Best-effort audit log write. NEVER throws — a logging failure must not roll
 * back the caller's real work. Call AFTER the main action has committed.
 */
export async function logActivity(opts: LogActivityOpts): Promise<void> {
  try {
    let actor = opts.actor;
    if (!actor && opts.req) {
      const session = await getStudioServerSession(
        opts.req,
        { getHeader() {}, setHeader() {} } as never,
      );
      const u = session?.user as { id?: string; role?: string; name?: string } | undefined;
      actor = u ? { id: u.id, role: u.role, name: u.name } : undefined;
    }

    const meta = opts.metadata ?? {};
    const { category, summary } = resolveAction(opts.action, meta);
    const details = buildActivityDetails(meta) || null;
    const userAgent =
      typeof opts.req?.headers["user-agent"] === "string"
        ? (opts.req?.headers["user-agent"] as string)
        : null;

    await prisma.activityLog.create({
      data: {
        actor_profile_id: actor?.id ?? null,
        actor_role: actor?.role ?? null,
        actor_name: actor?.name ?? null,
        target_profile_id: opts.targetProfileId ?? actor?.id ?? null,
        action: opts.action,
        category,
        summary,
        details,
        entity_type: opts.entity?.type ?? null,
        entity_id: opts.entity?.id ?? null,
        metadata: (meta as Prisma.InputJsonValue) ?? undefined,
        ip: clientIp(opts.req),
        user_agent: userAgent,
      },
    });
  } catch (err) {
    console.error("[logActivity] failed", opts.action, err);
  }
}
