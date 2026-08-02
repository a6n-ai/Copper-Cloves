import type { GetServerSideProps } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ProfileSection, type ProfileRole } from "@/components/profile/ProfileSection";
import { SEO } from "@/components/SEO";
import { primaryRole, hasRole } from "@/lib/auth/roles";

const VALID_ROLES = new Set<ProfileRole>(["user", "admin", "partner", "instructor"]);

export const getServerSideProps: GetServerSideProps<{ role: ProfileRole; isMember: boolean }> = async (
  ctx,
) => {
  const session = await getStudioServerSession(ctx.req as never, ctx.res as never);
  if (!session?.user) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  const rawRole = (session.user as { role?: string }).role;
  // Multi-role sessions carry a comma-separated string; the primary
  // (highest-privilege) role picks the page shell. ProfileSection has no
  // shell for "chef" — fall back to the member shell for anyone who also
  // holds "user" (e.g. "chef,user") instead of redirecting them out.
  const primary = primaryRole(rawRole);
  const role: ProfileRole | null =
    primary && VALID_ROLES.has(primary as ProfileRole)
      ? (primary as ProfileRole)
      : hasRole(rawRole, "user")
        ? "user"
        : null;
  if (!role) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  // Membership is checked independently of the shell role — a multi-role
  // session whose primary is e.g. "instructor" still holds "user" and must
  // still see its DOB/gender/questionnaire fields.
  return { props: { role, isMember: hasRole(rawRole, "user") } };
};

export default function AccountPage({ role, isMember }: { role: ProfileRole; isMember: boolean }) {
  return (
    <>
      <SEO title="Your Profile — The Studio" description="Manage your profile and password" />
      <ProfileSection role={role} isMember={isMember} />
    </>
  );
}
