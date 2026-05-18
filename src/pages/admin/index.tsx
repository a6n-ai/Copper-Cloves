import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: { destination: "/admin/dashboard", permanent: false },
  };
};

export default function AdminIndex() {
  return null;
}
