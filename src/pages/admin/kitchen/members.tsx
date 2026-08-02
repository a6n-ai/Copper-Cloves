import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "@/lib/auth/client";
import { SEO as Seo } from "@/components/SEO";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberTable, type MemberTableMember } from "@/components/admin/MemberTable";
import { Search } from "lucide-react";
import { hasRole } from "@/lib/auth/roles";

interface KitchenMember {
  id: string;
  name: string;
  email: string;
  passType: string;
  passCategory: "studio_pass" | "class_pass" | null;
  expiresAt: string | null;
  cafeDiscountPercent: number;
}

export default function KitchenMembers() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [members, setMembers] = useState<KitchenMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.push("/login");
      return;
    }
    const role = (session?.user as { role?: string })?.role;
    if (!hasRole(role, "admin") && !hasRole(role, "chef")) {
      router.push("/login");
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, session]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/kitchen/members");
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  const filtered = members.filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.passType.toLowerCase().includes(q)
    );
  });

  const tableMembers: MemberTableMember[] = filtered.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    passLabel: m.passType === "—" ? "No pass" : m.passType,
    passCategory:
      m.passCategory === "studio_pass"
        ? "studio_pass"
        : m.passCategory === "class_pass"
          ? "class_pass"
          : "none",
    cafeDiscountPct: m.cafeDiscountPercent,
  }));

  return (
    <>
      <Seo title="Members & Discounts - Kitchen" description="Member passes and café discounts" />
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <PageHeader
              title="Members & Discounts"
              subtitle="Each member's pass and the café discount it grants"
            />

            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, or pass…"
                className="pl-9 border-sage/20 font-body"
              />
            </div>

            <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
              {loading ? (
                <div className="divide-y divide-sage/10">
                  {["k1", "k2", "k3", "k4", "k5", "k6"].map((sk) => (
                    <div key={sk} className="flex items-center gap-4 px-4 py-4">
                      <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-5 w-24 rounded-md" />
                      <Skeleton className="h-5 w-12 rounded-md ml-auto" />
                    </div>
                  ))}
                </div>
              ) : (
                <MemberTable
                  members={tableMembers}
                  columns={["member", "pass", "cafeDiscount"]}
                  emptyState="No members found."
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
