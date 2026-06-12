import type { GetServerSideProps } from "next";

// Renamed to /admin/manual-entries. Permanent redirect preserves old bookmarks
// and ?tab= deep-links (tab values expenses/payouts are unchanged on the target).
export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const qs = new URLSearchParams(query as Record<string, string>).toString();
  return {
    redirect: {
      destination: `/admin/manual-entries${qs ? `?${qs}` : ""}`,
      permanent: true,
    },
  };
};

export default function AdminExpensesRedirect() {
  return null;
}
