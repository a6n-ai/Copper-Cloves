import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, X } from "lucide-react";
import { Spinner, PageLoader } from "@/components/ui/spinner";
import { toast } from "sonner";

interface PartnerClass { id: string; name: string }
interface PartnerManager { id: string; email: string; full_name: string | null }
interface Partner {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  classes: PartnerClass[];
  managers: PartnerManager[];
}
interface ClassOption { id: string; name: string }

export default function AdminPartners() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [allClasses, setAllClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // create form
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");

  const load = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/admin/partners", { credentials: "include" }),
        fetch("/api/admin/classes", { credentials: "include" }),
      ]);
      if (pRes.status === 403 || pRes.status === 401) {
        router.replace("/portal/login");
        return;
      }
      if (pRes.ok) setPartners(await pRes.json());
      if (cRes.ok) {
        const raw = await cRes.json();
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.classes) ? raw.classes : [];
        setAllClasses(list.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/portal/login"); return; }
    if (status === "authenticated") void load();
  }, [status, load, router]);

  async function createPartner(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, slug, managerEmail, managerPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not create partner"); return; }
      setName(""); setSlug(""); setManagerEmail(""); setManagerPassword("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/partners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Action failed");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading" || (loading && status === "authenticated")) {
    return (
      <div className="min-h-screen bg-cream">
        <PageLoader />
      </div>
    );
  }
  if ((session?.user as { role?: string })?.role !== "admin") {
    return <div className="min-h-screen flex items-center justify-center bg-cream font-body text-charcoal/60">Admins only.</div>;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
      <main className="max-w-5xl mx-auto p-6 lg:p-8 space-y-8">
        <AdminPageHeader title="Partners" subtitle="External brands renting the studio to run their own classes" />

        {/* Create partner */}
        <Card className="border-sage/20 bg-white/95">
          <CardHeader>
            <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
              <Plus className="h-5 w-5 text-sage" /> Add partner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createPartner} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-body text-sm text-charcoal">Partner name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Physique 57" required className="border-sage/20" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-sm text-charcoal">Slug (optional)</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="physique57" className="border-sage/20" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-sm text-charcoal">Manager email</Label>
                <Input type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} placeholder="manager@partner.com" required className="border-sage/20" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-sm text-charcoal">Manager password</Label>
                <Input value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)} placeholder="min 6 characters" required className="border-sage/20" />
              </div>
              {error && <div className="sm:col-span-2 text-sm text-red-600 font-body">{error}</div>}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy} variant="sage">
                  {busy ? <Spinner className="size-4" /> : "Create partner + login"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Partner list */}
        {partners.length === 0 ? (
          <Card className="border-sage/15 bg-white/80"><CardContent className="p-8 text-center font-body text-charcoal/50">No partners yet.</CardContent></Card>
        ) : (
          partners.map((p) => {
            const unassigned = allClasses.filter((c) => !p.classes.some((pc) => pc.id === c.id));
            return (
              <Card key={p.id} className="border-sage/20 bg-white/95">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-sage" /> {p.name}
                      <span className="font-body text-xs text-charcoal/40">/{p.slug}</span>
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={p.is_active ? "border-sage/30 text-sage bg-sage/5 cursor-pointer font-body" : "border-charcoal/15 text-charcoal/40 cursor-pointer font-body"}
                      onClick={() => patch({ id: p.id, is_active: !p.is_active })}
                    >
                      {p.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="font-body text-xs uppercase tracking-wide text-charcoal/50 mb-2">Classes ({p.classes.length})</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {p.classes.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sage/10 text-sage font-body text-xs">
                          {c.name}
                          <Button type="button" variant="terracotta-ghost" size="icon-sm" onClick={() => patch({ id: p.id, action: "unassign_class", classId: c.id })}>
                            <X className="h-3 w-3" />
                          </Button>
                        </span>
                      ))}
                      {p.classes.length === 0 && <span className="font-body text-sm text-charcoal/40">No classes assigned.</span>}
                    </div>
                    {unassigned.length > 0 && (
                      <Select onValueChange={(classId) => patch({ id: p.id, action: "assign_class", classId })}>
                        <SelectTrigger className="h-9 w-72 border-sage/20 font-body text-sm"><SelectValue placeholder="Assign a class…" /></SelectTrigger>
                        <SelectContent>
                          {unassigned.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <p className="font-body text-xs uppercase tracking-wide text-charcoal/50 mb-2">Logins ({p.managers.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {p.managers.map((m) => (
                        <span key={m.id} className="px-2.5 py-1 rounded-full bg-cream/60 border border-sage/15 font-body text-xs text-charcoal/70">{m.email}</span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
