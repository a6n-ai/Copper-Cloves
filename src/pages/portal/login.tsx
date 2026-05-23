import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const redirect = typeof ctx.query.redirect === "string" ? ctx.query.redirect : "";
  const destination = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login";
  return { redirect: { destination, permanent: false } };
};

export default function PortalLoginRedirect() {
  return null;
}
