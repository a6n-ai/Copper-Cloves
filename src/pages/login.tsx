import { SEO } from "@/components/SEO";
import { AuthExperience } from "@/components/auth/AuthExperience";

export default function LoginPage() {
  return (
    <>
      <SEO title="Sign In - The Studio by Copper + Cloves" description="Sign in to The Studio by Copper + Cloves" />
      <AuthExperience initialMode="signin" />
    </>
  );
}
