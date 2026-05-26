import type { GetServerSideProps } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ProfileSection, type ProfileRole } from "@/components/profile/ProfileSection";
import { SEO } from "@/components/SEO";

const VALID_ROLES = new Set<ProfileRole>(["user", "admin", "partner", "instructor"]);

export const getServerSideProps: GetServerSideProps<{ role: ProfileRole }> = async (ctx) => {
  const session = await getStudioServerSession(ctx.req as never, ctx.res as never);
  if (!session?.user) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  const role = (session.user as { role?: string }).role;
  if (!role || !VALID_ROLES.has(role as ProfileRole)) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  return { props: { role: role as ProfileRole } };
};

export default function AccountPage({ role }: { role: ProfileRole }) {
  return (
    <>
      <SEO title="Your Profile — The Studio" description="Manage your profile and password" />
      <ProfileSection role={role} />
    </>
  );
}
