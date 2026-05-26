import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Check } from "lucide-react";
import { toast } from "sonner";

function PartnerSettingsSkeleton() {
  return (
    <Card className="border-sage/20 bg-white/95">
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {/* Logo + URL row */}
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>

          {/* Partner name */}
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          {/* Login email + phone */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          {/* Save button */}
          <div className="pt-2">
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface PartnerProfile {
  name: string;
  slug?: string;
  logo_url: string | null;
  description: string | null;
  /** From the signed-in user's account, not the Partner row. */
  email: string;
  phone: string | null;
}

export default function PartnerSettings() {
  const router = useRouter();
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/partner/profile");
        if (res.status === 401) { router.replace("/partner/login"); return; }
        if (res.ok) setProfile(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/partner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error();
      setProfile(await res.json());
      setSaved(true);
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 2500);
    } catch {
      toast.error("Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-4 lg:p-6 space-y-6">
      <PageHeader title="Settings" subtitle="Manage your brand and login" />

      {loading ? (
        <PartnerSettingsSkeleton />
      ) : !profile ? (
        <Card className="border-terracotta/30 bg-terracotta/5"><CardContent className="p-4 font-body text-charcoal">Could not load your profile.</CardContent></Card>
      ) : (
        <Card className="border-sage/20 bg-white/95">
          <CardHeader>
            <CardTitle className="font-display text-xl text-charcoal">Partner profile</CardTitle>
            <CardDescription className="font-body text-charcoal/60">Your brand details shown across the studio.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-5">
              <div className="flex items-center gap-4">
                {profile.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.logo_url} alt="" className="h-16 w-16 rounded-full object-cover border border-sage/20" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-sage/10 flex items-center justify-center font-display text-sage text-lg">
                    {profile.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 space-y-1.5">
                  <Label className="font-body text-sm text-charcoal">Logo / icon URL</Label>
                  <Input value={profile.logo_url ?? ""} onChange={(e) => setProfile({ ...profile, logo_url: e.target.value })} placeholder="https://…/logo.png" className="border-sage/20" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-body text-sm text-charcoal">Partner name</Label>
                <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="border-sage/20" />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal">Login email</Label>
                  <Input type="email" value={profile.email ?? ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="you@partner.com" className="border-sage/20" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal">Phone</Label>
                  <Input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+91 …" className="border-sage/20" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-body text-sm text-charcoal">Description</Label>
                <Input value={profile.description ?? ""} onChange={(e) => setProfile({ ...profile, description: e.target.value })} placeholder="Short description of your brand" className="border-sage/20" />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={saving} variant="sage">
                  {saving ? <Spinner className="size-4" /> : "Save changes"}
                </Button>
                {saved && <span className="font-body text-sm text-sage flex items-center gap-1"><Check className="h-4 w-4" /> Saved</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const sess = await getStudioServerSession(context.req as never, context.res as never);
  const user = sess?.user as { role?: string; partner_id?: string | null } | undefined;
  if (!user || user.role !== "partner" || !user.partner_id) {
    return { redirect: { destination: "/partner/login", permanent: false } };
  }
  return { props: {} };
};
