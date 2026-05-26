import { useRouter } from "next/router";
import { SEO } from "@/components/SEO";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { useAuthWeather } from "@/hooks/useAuthWeather";

export default function ResetPasswordPage() {
  const router = useRouter();
  const token = router.query.token as string | undefined;
  const { palette, weather } = useAuthWeather();

  return (
    <>
      <SEO title="Reset Password — The Studio" description="Choose a new password" />
      <AuthShell weather={weather} palette={palette}>
        <ResetPasswordForm token={token} />
      </AuthShell>
    </>
  );
}
