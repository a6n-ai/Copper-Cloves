import type { GetServerSideProps } from "next";

// The founder story now lives inside the consolidated `/story` page. Keep this
// route as a permanent redirect so existing links and bookmarks still resolve.
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/story", permanent: true },
});

export default function FounderRedirect() {
  return null;
}
