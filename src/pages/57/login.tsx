import type { GetServerSideProps } from "next";

// Physique 57 moved into the generic Partner portal.
export default function P57LoginRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/partner/login", permanent: false },
});
