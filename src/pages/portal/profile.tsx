import type { GetServerSideProps } from "next";

/** Legacy route: profile now lives at /account (unified across all portals). */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/account", permanent: false },
});

export default function PortalProfileRedirect() {
  return null;
}
