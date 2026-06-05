import { PageHeader } from "@/components/dashboard/PageHeader";
import { PauseSubscriptionCard } from "@/components/profile/PauseSubscriptionCard";
import { PauseRequestsList } from "@/components/profile/PauseRequestsList";
import { SEO as Seo } from "@/components/SEO";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP({ roles: ["user"] });

export default function PausePassPage() {
  return (
    <>
      <Seo title="Pause Pass — The Studio" description="Request to pause your active pass" />
      <div className="min-h-screen bg-cream">
        <main className="pt-8 pb-16 min-h-screen">
          <div className="max-w-6xl mx-auto mb-6 px-4 sm:px-6 lg:px-8">
            <PageHeader title="Pause Pass" subtitle="Request to pause your active membership" />
          </div>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <PauseSubscriptionCard />
            <PauseRequestsList />
          </div>
        </main>
      </div>
    </>
  );
}