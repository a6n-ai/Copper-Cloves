import prisma from "@/lib/prisma";
import type { requestLogger } from "@/lib/logger";

type Log = ReturnType<typeof requestLogger>;

const BADGE_TYPE_PTM = "path_to_mastery" as const;

export async function awardPtmBadges(userId: string, log: Log) {
  try {
    const [totalClasses, ptmTemplates] = await Promise.all([
      prisma.booking.count({ where: { user_id: userId, checked_in: true } }),
      prisma.badgeTemplate.findMany({ where: { badge_type: BADGE_TYPE_PTM, is_active: true } }),
    ]);

    const eligible = ptmTemplates.filter(
      (t) => t.threshold_classes !== null && totalClasses >= t.threshold_classes,
    );
    if (eligible.length === 0) return;

    // Check which badges are already earned in a single batch query.
    const earned = await prisma.userBadge.findMany({
      where: {
        user_id: userId,
        OR: eligible.flatMap((t) => [
          { badge_template_id: t.id },
          { badge_name: t.name, badge_type: BADGE_TYPE_PTM },
        ]),
      },
      select: { badge_template_id: true, badge_name: true },
    });
    const earnedTemplateIds = new Set(earned.map((e) => e.badge_template_id));
    const earnedNames = new Set(earned.map((e) => e.badge_name));

    const toCreate = eligible.filter(
      (t) => !earnedTemplateIds.has(t.id) && !earnedNames.has(t.name),
    );
    if (toCreate.length === 0) return;

    await prisma.userBadge.createMany({
      data: toCreate.map((template) => ({
        user_id: userId,
        badge_template_id: template.id,
        badge_name: template.name,
        badge_description: template.description ?? null,
        badge_type: BADGE_TYPE_PTM,
        icon: template.icon,
        color: template.color,
        milestone_value: template.threshold_classes,
        total_classes: totalClasses,
      })),
      skipDuplicates: true,
    });
  } catch (e) {
    log.error({ err: e }, "check-in badge auto-award failed");
  }
}
