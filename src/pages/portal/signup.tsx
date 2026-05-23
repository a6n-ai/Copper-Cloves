import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const redirect = typeof ctx.query.redirect === "string" ? ctx.query.redirect : "";
  const destination = redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : "/signup";
  return { redirect: { destination, permanent: false } };
};

export default function PortalSignupRedirect() {
  return null;
}
