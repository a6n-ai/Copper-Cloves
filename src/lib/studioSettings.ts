/**
 * Studio-wide settings singleton (mirrors the PayoutSettings pattern). One row,
 * id "default". Use getStudioSettings() everywhere a cancellation cutoff or a
 * package/cancelled-pass validity is needed so the values can never drift.
 */
import prisma from "@/lib/prisma";
import type { StudioSettings } from "@/generated/prisma/client";

export const STUDIO_SETTINGS_ID = "default";

export const STUDIO_SETTINGS_DEFAULTS = {
  cancellation_cutoff_hours: 6,
  default_package_validity_days: 30,
  cancelled_pass_validity_days: 7,
} as const;

/**
 * Returns the singleton settings row, creating it with defaults on first read
 * (upsert-on-read). Always safe to call; never returns null.
 */
export async function getStudioSettings(): Promise<StudioSettings> {
  return prisma.studioSettings.upsert({
    where: { id: STUDIO_SETTINGS_ID },
    update: {},
    create: { id: STUDIO_SETTINGS_ID, ...STUDIO_SETTINGS_DEFAULTS },
  });
}
