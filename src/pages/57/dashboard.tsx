import type { GetServerSideProps } from "next";

// Physique 57 moved into the generic Partner portal.
export default function P57DashboardRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/partner/dashboard", permanent: false },
});
