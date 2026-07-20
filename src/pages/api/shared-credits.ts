import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { activeFriendIds } from "@/lib/friendQueries";
import { canShare, type ShareDenyReason } from "@/lib/sharedCredits";
import { getStudioSettings } from "@/lib/studioSettings";
import { logActivity } from "@/lib/activityLog";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import logger from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  const me = session?.user?.id;
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    const rows = await prisma.sharedCredit.findMany({
      where: { recipient_user_id: me, status: "active" },
      include: { owner: { select: { full_name: true, email: true, avatar_url: true } } },
      orderBy: { created_at: "desc" },
    });
    return res.status(200).json(
      rows.map((r) => ({
        id: r.id,
        ownerName: r.owner.full_name ?? r.owner.email,
        ownerAvatarUrl: r.owner.avatar_url ?? null,
        creditsRemaining: r.credits_remaining,
        creditsTotal: r.credits_total,
        expiresAt: r.expiration_date.toISOString(),
      })),
    );
  }

  if (req.method === "POST") {
    const { recipient_id, user_package_id, credits } = (req.body ?? {}) as {
      recipient_id?: string;
      user_package_id?: string;
      credits?: number;
    };
    if (!recipient_id || !user_package_id) {
      return res.status(400).json({ error: "recipient_id and user_package_id required" });
    }

    const friendIds = await activeFriendIds(me);
    if (!friendIds.includes(recipient_id)) {
      return res.status(400).json({ error: "You can only share with an active friend" });
    }

    const pkg = await prisma.userPackage.findUnique({ where: { id: user_package_id } });
    if (!pkg || pkg.user_id !== me) return res.status(400).json({ error: "Invalid pass" });

    const settings = await getStudioSettings();
    const agg = await prisma.sharedCredit.aggregate({
      where: { source_user_package_id: user_package_id, status: "active" },
      _sum: { credits_total: true },
    });
    const alreadyShared = agg._sum.credits_total ?? 0;

    const requested = Number(credits);
    const check = canShare({
      creditsTotal: pkg.credits_total,
      creditsRemaining: pkg.credits_remaining ?? 0,
      requested,
      alreadyShared,
      maxSharedPercent: settings.max_shared_percent,
    });
    // strictNullChecks is off, which breaks discriminated-union narrowing on `ok`
    // (see .llm/known-issues.md #6) — assert the error-branch shape explicitly.
    if (!check.ok) {
      const reason = (check as { ok: false; reason?: ShareDenyReason }).reason;
      const messages: Record<string, string> = {
        INVALID_AMOUNT: "Enter a valid number of classes",
        UNLIMITED_NOT_SHAREABLE: "This pass can't be shared",
        INSUFFICIENT_CREDITS: "Not enough classes left on this pass",
        CAP_EXCEEDED: "You've already shared the most you're allowed from this pass",
      };
      return res.status(400).json({ error: messages[reason ?? ""] ?? "Can't share this amount" });
    }

    const recipient = await prisma.profile.findFirst({
      where: { id: recipient_id, role: "user" },
      select: { email: true, full_name: true },
    });
    if (!recipient) return res.status(400).json({ error: "Recipient not found" });

    const created = await prisma.$transaction(async (tx) => {
      await tx.userPackage.update({
        where: { id: user_package_id },
        data: { credits_remaining: (pkg.credits_remaining ?? 0) - requested },
      });
      return tx.sharedCredit.create({
        data: {
          source_user_package_id: user_package_id,
          owner_user_id: me,
          recipient_user_id: recipient_id,
          credits_total: requested,
          credits_remaining: requested,
          status: "active",
          expiration_date: pkg.expiration_date,
        },
      });
    });

    await logActivity({
      req,
      action: "user.pass_shared",
      targetProfileId: recipient_id,
      entity: { type: "shared_credit", id: created.id },
      metadata: { credits: requested, source_user_package_id: user_package_id },
    });

    const sharerName = session.user?.name ?? "A friend";
    await sendHtmlEmail({
      to: recipient.email,
      subject: `${sharerName} shared classes with you`,
      html: `
        <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#2C2C2C">
          <h2 style="font-size:22px;margin-bottom:8px">You've received shared classes</h2>
          <p style="color:#666;margin-bottom:24px">
            ${sharerName} shared ${requested} class${requested === 1 ? "" : "es"} with you at The Studio by Copper + Cloves.
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:32px 0" />
          <p style="color:#bbb;font-size:12px">The Studio by Copper + Cloves</p>
        </div>
      `,
    }).catch((e) => logger.error({ err: e }, "[shared-credits email]"));

    return res.status(200).json({ ok: true, shared_credit_id: created.id });
  }

  return res.status(405).end();
}
