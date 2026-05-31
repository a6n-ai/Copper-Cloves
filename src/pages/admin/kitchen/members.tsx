import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { SEO } from "@/components/SEO";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Search } from "lucide-react";

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
  const { data: session, status } = useSession();
  const [members, setMembers] = useState<KitchenMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    const role = (session?.user as { role?: string })?.role;
    if (status === "authenticated" && role !== "admin" && role !== "chef") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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

  return (
    <>
      <SEO title="Members & Discounts - Kitchen" description="Member passes and café discounts" />
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
              <ResponsiveTable>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                      <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Member</TableHead>
                      <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Email</TableHead>
                      <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Pass type</TableHead>
                      <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 text-right">Café discount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i} className="border-sage/10">
                          <TableCell className="px-5 py-3"><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell className="px-5 py-3"><Skeleton className="h-4 w-48" /></TableCell>
                          <TableCell className="px-5 py-3"><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell className="px-5 py-3 text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow className="border-sage/10">
                        <TableCell colSpan={4} className="px-5 py-10 text-center font-body text-charcoal/50">
                          No members found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((m) => (
                        <TableRow key={m.id} className="border-sage/10 hover:bg-sage/5">
                          <TableCell className="px-5 py-3 font-body font-medium text-charcoal">{m.name}</TableCell>
                          <TableCell className="px-5 py-3 font-body text-sm text-charcoal/60">{m.email}</TableCell>
                          <TableCell className="px-5 py-3">
                            {m.passType === "—" ? (
                              <span className="font-body text-sm text-charcoal/40">—</span>
                            ) : (
                              <span className="font-body text-sm text-charcoal">{m.passType}</span>
                            )}
                          </TableCell>
                          <TableCell className="px-5 py-3 text-right">
                            <Badge
                              className={
                                m.cafeDiscountPercent > 0
                                  ? "bg-terracotta/10 text-terracotta border-terracotta/20 font-body"
                                  : "bg-charcoal/5 text-charcoal/40 border-charcoal/10 font-body"
                              }
                            >
                              {m.cafeDiscountPercent}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
