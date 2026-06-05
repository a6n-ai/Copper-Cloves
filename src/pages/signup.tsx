import { SEO as Seo } from "@/components/SEO";
import { AuthExperience } from "@/components/auth/AuthExperience";

export default function SignupPage() {
  return (
    <>
      <Seo title="Sign Up - The Studio by Copper + Cloves" description="Create your account and start your wellness journey" />
      <AuthExperience initialMode="signup" />
    </>
  );
}
