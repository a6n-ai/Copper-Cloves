import { useState } from "react";
import { useRouter } from "next/router";
import { useSession, signIn } from "next-auth/react";
import { ArrowLeftRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

/**
 * Seamless role switch for people whose email owns both a member and an
 * instructor profile. Re-issues the session for the other role (no password,
 * server verifies the existing session — see authOptions `mode:"switch"`).
 * Renders nothing for single-role accounts.
 */
export function RoleSwitcher({ className = "" }: { className?: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const user = session?.user as
    | { email?: string; role?: string; available_roles?: string[] }
    | undefined;
  const email = user?.email;
  const role = user?.role;
  const roles = user?.available_roles ?? [];

  let target: "instructor" | "user" | null = null;
  let label = "";
  if (role !== "instructor" && roles.includes("instructor")) {
    target = "instructor";
    label = "Switch to Instructor";
  } else if (role === "instructor" && roles.includes("user")) {
    target = "user";
    label = "Switch to Member";
  }

  if (!email || !target) return null;

  async function go() {
    if (!email || !target) return;
    setBusy(true);
    const res = await signIn("credentials", { email, role: target, mode: "switch", redirect: false });
    if (res?.ok) {
      await router.replace(target === "instructor" ? "/instructor/dashboard" : "/portal/dashboard");
    } else {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="sage-outline"
      size="sm"
      onClick={go}
      disabled={busy}
      className={`rounded-full bg-sage/5 ${className}`}
    >
      {busy ? <Spinner className="size-4" /> : <ArrowLeftRight className="h-4 w-4" />}
      {busy ? "Switching…" : label}
    </Button>
  );
}
