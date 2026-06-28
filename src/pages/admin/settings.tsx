import { useEffect } from "react";
import { useRouter } from "next/router";

/** Settings has been merged into the Control Panel. */
export default function SettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/control");
  }, [router]);
  return null;
}
