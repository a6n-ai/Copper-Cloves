import { useStudioSWR } from "@/lib/swr";
import { splitPricingPlans, type PricingPlan, type PublicPackageRow } from "@/lib/pricingPlans";

/**
 * Public packages for the marketing pages — fetches published PackageType rows
 * from GET /api/packages (DB source of truth) and splits them into studio/class
 * pricing tiers. Used by the homepage teaser and the /pricing page.
 */
export function usePublicPackages(): {
  studioPlans: PricingPlan[];
  classPlans: PricingPlan[];
  isLoading: boolean;
} {
  const { data, isLoading } = useStudioSWR<PublicPackageRow[]>("/api/packages");
  const { studioPlans, classPlans } = splitPricingPlans(Array.isArray(data) ? data : []);
  return { studioPlans, classPlans, isLoading };
}
