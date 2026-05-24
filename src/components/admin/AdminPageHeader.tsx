import { PageHeader, type PageHeaderProps } from "@/components/dashboard/PageHeader";

/** @deprecated Use `PageHeader` from `@/components/dashboard/PageHeader` directly. */
export function AdminPageHeader(props: PageHeaderProps) {
  return <PageHeader {...props} />;
}

export default AdminPageHeader;
