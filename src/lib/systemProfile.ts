import prisma from "@/lib/prisma";

let cachedId: string | null = null;

/**
 * Resolve the single system "Studio" profile id (Profile.is_system = true).
 * Used as the Payment.user_id fallback for studio-funded expense debit rows
 * that have no real member/instructor counterparty. Cached for the process.
 * Throws if the profile is missing — run `npm run db:seed:system-profile`.
 */
export async function getSystemProfileId(): Promise<string> {
  if (cachedId) return cachedId;
  const row = await prisma.profile.findFirst({
    where: { is_system: true },
    select: { id: true },
  });
  if (!row) {
    throw new Error(
      "System profile missing. Run `npm run db:seed:system-profile`.",
    );
  }
  cachedId = row.id;
  return cachedId;
}
