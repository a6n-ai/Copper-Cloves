import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession } from "@/lib/auth/client";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Copy, KeyRound, Plus, X } from "lucide-react";
import { Spinner, PageLoader } from "@/components/ui/spinner";
import { toast } from "sonner";
import { hasRole } from "@/lib/auth/roles";

interface PartnerClass { id: string; name: string }
interface PartnerManager { id: string; email: string; full_name: string | null }
interface PartnerApiKey { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null }
interface Partner {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  classes: PartnerClass[];
  managers: PartnerManager[];
  api_keys: PartnerApiKey[];
}

function formatWhen(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "never";
}
interface ClassOption { id: string; name: string }

export default function AdminPartners() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
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

  // API keys: draft name per partner, and the one freshly created plaintext key
  const [keyNames, setKeyNames] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState<{ partnerId: string; key: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/admin/partners", { credentials: "include" }),
        fetch("/api/admin/classes", { credentials: "include" }),
      ]);
      if (pRes.status === 403 || pRes.status === 401) {
        router.replace("/login");
        return;
      }
      if (pRes.ok) setPartners(await pRes.json());
      if (cRes.ok) {
        const raw = await cRes.json();
        let list: { id: string; name: string }[] = [];
        if (Array.isArray(raw)) {
          list = raw;
        } else if (Array.isArray(raw?.classes)) {
          list = raw.classes;
        }
        setAllClasses(list.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) { router.replace("/login"); return; }
    void load();
  }, [isPending, session, load, router]);

  async function createPartner(e: React.SyntheticEvent<HTMLFormElement>) {
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

  async function createApiKey(partnerId: string) {
    const keyName = (keyNames[partnerId] ?? "").trim();
    if (!keyName) { toast.error("Name the key first, e.g. the partner's system"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/partners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: partnerId, action: "create_api_key", name: keyName }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error ?? "Could not create key"); return; }
      setNewKey({ partnerId, key: d.key });
      setKeyNames((prev) => ({ ...prev, [partnerId]: "" }));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revokeApiKey(partnerId: string, k: PartnerApiKey) {
    if (!window.confirm(`Revoke "${k.name}"? Anything using this key stops working immediately.`)) return;
    await patch({ id: partnerId, action: "revoke_api_key", keyId: k.id });
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      toast.success("Key copied");
    } catch {
      toast.error("Copy failed — select the key and copy it manually");
    }
  }

  if (isPending || (loading && !!session?.user)) {
    return (
      <div className="min-h-screen bg-cream">
        <PageLoader />
      </div>
    );
  }
  if (!hasRole((session?.user as { role?: string })?.role, "admin")) {
    return <div className="min-h-screen flex items-center justify-center bg-cream font-body text-charcoal/60">Admins only.</div>;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
      <main className="max-w-5xl mx-auto p-6 lg:p-8 space-y-8">
        <AdminPageHeader title="Partners" subtitle="External brands renting the studio to run their own classes" />

        {/* Create partner */}
        <Card className="border-sage/20 bg-card/95">
          <CardHeader>
            <CardTitle className="font-body font-semibold text-xl text-charcoal flex items-center gap-2">
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
              {error && <div className="sm:col-span-2 text-sm text-destructive font-body">{error}</div>}
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
          <Card className="border-sage/15 bg-card/80"><CardContent className="p-8 text-center font-body text-charcoal/50">No partners yet.</CardContent></Card>
        ) : (
          partners.map((p) => {
            const unassigned = allClasses.filter((c) => !p.classes.some((pc) => pc.id === c.id));
            return (
              <Card key={p.id} className="border-sage/20 bg-card/95">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="font-body font-semibold text-xl text-charcoal flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-sage" /> {p.name}
                      <span className="font-body text-xs text-charcoal/40">/{p.slug}</span>
                    </CardTitle>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch
                        checked={p.is_active}
                        disabled={busy}
                        onCheckedChange={(checked) => patch({ id: p.id, is_active: checked })}
                        activityLabel="partner_active_toggle"
                        className="focus-visible:ring-sage data-[state=checked]:bg-sage"
                      />
                      <span className="font-body text-sm text-charcoal/70 select-none">
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </label>
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
                        <SelectTrigger className="h-9 w-full sm:w-72 border-sage/20 font-body text-sm"><SelectValue placeholder="Assign a class…" /></SelectTrigger>
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
                  <div>
                    <p className="font-body text-xs uppercase tracking-wide text-charcoal/50 mb-2">
                      API keys ({p.api_keys.length}) ·{" "}
                      <a href="/partner-api.html" target="_blank" rel="noreferrer" className="normal-case tracking-normal text-sage underline-offset-2 hover:underline">
                        API docs
                      </a>
                    </p>
                    {newKey?.partnerId === p.id && (
                      <div className="mb-3 rounded-lg border border-terracotta/30 bg-terracotta/5 p-3 space-y-2">
                        <p className="font-body text-sm text-charcoal">
                          Copy this key now and send it to the partner securely. It is not shown again.
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 min-w-0 break-all rounded-md bg-white-warm border border-sage/15 px-2 py-1.5 font-mono text-xs text-charcoal">
                            {newKey.key}
                          </code>
                          <Button type="button" variant="sage" size="sm" onClick={() => copyKey(newKey.key)}>
                            <Copy className="h-3.5 w-3.5" /> Copy
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => setNewKey(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5 mb-2">
                      {p.api_keys.map((k) => (
                        <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sage/15 bg-cream/40 px-3 py-2">
                          <div className="min-w-0 font-body text-sm">
                            <span className="text-charcoal flex items-center gap-1.5">
                              <KeyRound className="h-3.5 w-3.5 text-sage shrink-0" /> {k.name}
                              <code className="font-mono text-xs text-charcoal/50">{k.prefix}…</code>
                            </span>
                            <span className="text-xs text-charcoal/50">
                              Created {formatWhen(k.created_at)} · Last used {formatWhen(k.last_used_at)}
                            </span>
                          </div>
                          <Button type="button" variant="terracotta-ghost" size="sm" disabled={busy} onClick={() => revokeApiKey(p.id, k)}>
                            Revoke
                          </Button>
                        </div>
                      ))}
                      {p.api_keys.length === 0 && <span className="font-body text-sm text-charcoal/40">No API keys.</span>}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        value={keyNames[p.id] ?? ""}
                        onChange={(e) => setKeyNames((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="Key name, e.g. Physique 57 booking sync"
                        maxLength={80}
                        className="h-9 w-full sm:w-72 border-sage/20 font-body text-sm"
                      />
                      <Button type="button" variant="sage" disabled={busy || !p.is_active} onClick={() => createApiKey(p.id)}>
                        Create key
                      </Button>
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
