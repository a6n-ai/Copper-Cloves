import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import {
  Mail,
  Phone,
  Award,
  Sparkles,
  Briefcase,
  Linkedin,
  Twitter,
  Facebook,
  MessageCircle,
  User as UserIcon,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditButton, DeleteButton } from "@/components/ui/quick-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Instructor = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  studio_payout_cut_percent: string | number | null;
  image_url: string | null;
  about: string | null;
  philosophy: string | null;
  specialties: string[];
  certifications: string[];
  years_of_experience: string | null;
  social_facebook: string | null;
  social_twitter: string | null;
  social_linkedin: string | null;
  social_whatsapp: string | null;
  is_active: boolean;
  display_order: number | null;
};

type FormState = {
  name: string;
  title: string;
  email: string;
  phone: string;
  studio_payout_cut_percent: string;
  image_url: string;
  about: string;
  philosophy: string;
  specialties: string;
  certifications: string;
  years_of_experience: string;
  social_facebook: string;
  social_twitter: string;
  social_linkedin: string;
  social_whatsapp: string;
};

export default function InstructorProfilePage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const { status } = useSession();
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/instructors/${id}`);
      if (r.ok) setInstructor(await r.json());
      else if (r.status === 404) toast.error("Instructor not found");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  function openEdit() {
    if (!instructor) return;
    setForm({
      name: instructor.name ?? "",
      title: instructor.title ?? "",
      email: instructor.email ?? "",
      phone: instructor.phone ?? "",
      studio_payout_cut_percent: instructor.studio_payout_cut_percent != null ? String(instructor.studio_payout_cut_percent) : "",
      image_url: instructor.image_url ?? "",
      about: instructor.about ?? "",
      philosophy: instructor.philosophy ?? "",
      specialties: (instructor.specialties ?? []).join(", "),
      certifications: (instructor.certifications ?? []).join(", "),
      years_of_experience: instructor.years_of_experience ?? "",
      social_facebook: instructor.social_facebook ?? "",
      social_twitter: instructor.social_twitter ?? "",
      social_linkedin: instructor.social_linkedin ?? "",
      social_whatsapp: instructor.social_whatsapp ?? "",
    });
    setEditOpen(true);
  }

  async function save() {
    if (!form || !instructor) return;
    setSaving(true);
    try {
      const payload = {
        id: instructor.id,
        name: form.name.trim(),
        title: form.title.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        studio_payout_cut_percent: form.studio_payout_cut_percent ? Number(form.studio_payout_cut_percent) : null,
        image_url: form.image_url.trim() || null,
        about: form.about.trim() || null,
        philosophy: form.philosophy.trim() || null,
        specialties: form.specialties.split(",").map((s) => s.trim()).filter(Boolean),
        certifications: form.certifications.split(",").map((s) => s.trim()).filter(Boolean),
        years_of_experience: form.years_of_experience.trim() || null,
        social_facebook: form.social_facebook.trim() || null,
        social_twitter: form.social_twitter.trim() || null,
        social_linkedin: form.social_linkedin.trim() || null,
        social_whatsapp: form.social_whatsapp.trim() || null,
      };
      const r = await fetch(`/api/admin/instructors`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success("Profile updated");
      setEditOpen(false);
      await load();
    } catch (err) {
      toast.error(`Could not save: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(next: boolean) {
    if (!instructor) return;
    const r = await fetch(`/api/admin/instructors?id=${instructor.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: next }),
    });
    if (r.ok) {
      setInstructor({ ...instructor, is_active: next });
      toast.success(next ? "Instructor reactivated" : "Instructor archived");
    } else {
      toast.error("Could not update status");
    }
  }

  async function handleDelete() {
    if (!instructor) return;
    const r = await fetch(`/api/admin/instructors?id=${instructor.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (r.ok) {
      toast.success("Instructor removed");
      router.push("/admin/instructors");
    } else {
      toast.error("Could not delete");
    }
  }

  return (
    <>
      <SEO title="Instructor — Admin" description="Instructor profile management" />
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
            <PageHeader
              title={instructor?.name ?? "Instructor"}
              subtitle={instructor?.title ?? "Instructor profile"}
              crumbs={[
                { label: "Dashboard", href: "/admin/dashboard" },
                { label: "Instructors", href: "/admin/instructors" },
                { label: instructor?.name ?? "—" },
              ]}
            />

            {loading || !instructor ? (
              <ProfileSkeleton />
            ) : (
              <>
                {/* Hero card */}
                <div className="relative overflow-hidden rounded-2xl border border-sage/20 bg-linear-to-br from-sage/8 via-white to-cream/30 shadow-xs">
                  <div className="absolute -top-12 -right-12 size-48 rounded-full bg-sage/10 blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-16 -left-16 size-56 rounded-full bg-cream/40 blur-3xl pointer-events-none" />

                  <div className="relative grid grid-cols-1 gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
                    <div className="relative shrink-0">
                      {instructor.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={instructor.image_url}
                          alt={instructor.name}
                          className="size-24 rounded-full object-cover ring-4 ring-white shadow-md"
                        />
                      ) : (
                        <div className="size-24 rounded-full bg-linear-to-br from-sage to-sage/70 text-white font-display text-3xl flex items-center justify-center ring-4 ring-white shadow-md">
                          {(instructor.name ?? "I").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 size-7 rounded-full bg-white shadow-sm flex items-center justify-center">
                        <UserIcon className="h-3.5 w-3.5 text-sage" />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="font-body text-[11px] uppercase tracking-[0.18em] text-charcoal/50">
                        {instructor.is_active ? "Active instructor" : "Archived"}
                      </p>
                      <h2 className="font-display text-3xl text-charcoal truncate mt-0.5">{instructor.name}</h2>
                      {instructor.title && (
                        <p className="font-body text-sm text-charcoal/65 mt-1">{instructor.title}</p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-3 font-body text-xs text-charcoal/65">
                        {instructor.email && (
                          <a href={`mailto:${instructor.email}`} className="inline-flex items-center gap-1.5 hover:text-sage">
                            <Mail className="h-3.5 w-3.5" />
                            {instructor.email}
                          </a>
                        )}
                        {instructor.phone && (
                          <a href={`tel:${instructor.phone}`} className="inline-flex items-center gap-1.5 hover:text-sage">
                            <Phone className="h-3.5 w-3.5" />
                            {instructor.phone}
                          </a>
                        )}
                        {instructor.years_of_experience && (
                          <span className="inline-flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5" />
                            {instructor.years_of_experience} experience
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 md:items-end">
                      <div className="flex items-center gap-2">
                        <span className="font-body text-xs text-charcoal/55">Active</span>
                        <Switch checked={instructor.is_active} onCheckedChange={toggleActive} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <EditButton onClick={openEdit} label="Edit profile" />
                        <DeleteButton
                          onClick={handleDelete}
                          confirmTitle="Delete this instructor?"
                          confirmDescription={`${instructor.name} will be permanently removed. Past class history is preserved but they'll no longer appear in scheduling.`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* About + Philosophy */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card className="rounded-2xl shadow-xs">
                    <CardHeader>
                      <CardTitle className="font-display text-lg text-charcoal flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-sage" />
                        About
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-body text-sm text-charcoal/75 whitespace-pre-line">
                        {instructor.about || <span className="text-charcoal/40 italic">No bio added yet.</span>}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl shadow-xs">
                    <CardHeader>
                      <CardTitle className="font-display text-lg text-charcoal flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-sage" />
                        Teaching philosophy
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-body text-sm text-charcoal/75 whitespace-pre-line">
                        {instructor.philosophy || <span className="text-charcoal/40 italic">No philosophy added yet.</span>}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Specialties + Certifications */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card className="rounded-2xl shadow-xs">
                    <CardHeader>
                      <CardTitle className="font-display text-lg text-charcoal flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-sage" />
                        Specialties
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(instructor.specialties?.length ?? 0) === 0 ? (
                        <p className="font-body text-sm text-charcoal/40 italic">None added.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {instructor.specialties.map((s) => (
                            <Badge key={s} variant="outline" className="capitalize font-body bg-sage/10 text-sage border-sage/30">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl shadow-xs">
                    <CardHeader>
                      <CardTitle className="font-display text-lg text-charcoal flex items-center gap-2">
                        <Award className="h-4 w-4 text-sage" />
                        Certifications
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(instructor.certifications?.length ?? 0) === 0 ? (
                        <p className="font-body text-sm text-charcoal/40 italic">None added.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {instructor.certifications.map((c) => (
                            <li key={c} className="font-body text-sm text-charcoal/75 flex items-start gap-2">
                              <Award className="h-3.5 w-3.5 text-sage shrink-0 mt-0.5" />
                              {c}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Socials + Payout */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card className="rounded-2xl shadow-xs">
                    <CardHeader>
                      <CardTitle className="font-display text-lg text-charcoal">Social</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <SocialLine icon={Linkedin} label="LinkedIn" value={instructor.social_linkedin} />
                      <SocialLine icon={Twitter} label="Twitter / X" value={instructor.social_twitter} />
                      <SocialLine icon={Facebook} label="Facebook" value={instructor.social_facebook} />
                      <SocialLine icon={MessageCircle} label="WhatsApp" value={instructor.social_whatsapp} />
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl shadow-xs">
                    <CardHeader>
                      <CardTitle className="font-display text-lg text-charcoal">Payout</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {instructor.studio_payout_cut_percent != null ? (
                        <div className="space-y-1">
                          <p className="font-display text-2xl text-charcoal tabular-nums">
                            {Number(instructor.studio_payout_cut_percent).toFixed(2)}% <span className="font-body text-sm text-charcoal/55">studio cut</span>
                          </p>
                          <p className="font-body text-xs text-charcoal/55">
                            Instructor receives {(100 - Number(instructor.studio_payout_cut_percent)).toFixed(2)}% of check-in revenue.
                          </p>
                        </div>
                      ) : (
                        <p className="font-body text-sm text-charcoal/40 italic">No payout split configured.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-charcoal">Edit instructor</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
              <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label="Image URL" value={form.image_url} onChange={(v) => setForm({ ...form, image_url: v })} className="sm:col-span-2" />
              <Field label="Years of experience" value={form.years_of_experience} onChange={(v) => setForm({ ...form, years_of_experience: v })} />
              <Field label="Studio cut (%)" type="number" value={form.studio_payout_cut_percent} onChange={(v) => setForm({ ...form, studio_payout_cut_percent: v })} />
              <TextField label="About" value={form.about} onChange={(v) => setForm({ ...form, about: v })} className="sm:col-span-2" />
              <TextField label="Philosophy" value={form.philosophy} onChange={(v) => setForm({ ...form, philosophy: v })} className="sm:col-span-2" />
              <Field label="Specialties (comma separated)" value={form.specialties} onChange={(v) => setForm({ ...form, specialties: v })} className="sm:col-span-2" />
              <Field label="Certifications (comma separated)" value={form.certifications} onChange={(v) => setForm({ ...form, certifications: v })} className="sm:col-span-2" />
              <Field label="LinkedIn" value={form.social_linkedin} onChange={(v) => setForm({ ...form, social_linkedin: v })} />
              <Field label="Twitter / X" value={form.social_twitter} onChange={(v) => setForm({ ...form, social_twitter: v })} />
              <Field label="Facebook" value={form.social_facebook} onChange={(v) => setForm({ ...form, social_facebook: v })} />
              <Field label="WhatsApp" value={form.social_whatsapp} onChange={(v) => setForm({ ...form, social_whatsapp: v })} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving} className="font-body">Cancel</Button>
            <Button onClick={save} disabled={saving} variant="sage">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value, onChange, type = "text", className }: { label: string; value: string; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="font-body text-xs text-charcoal/65">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextField({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="font-body text-xs text-charcoal/65">{label}</Label>
      <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SocialLine({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-3 font-body text-sm">
      <Icon className="h-4 w-4 text-sage shrink-0" />
      <span className="text-charcoal/55 w-20 shrink-0">{label}</span>
      {value ? (
        <a href={value.startsWith("http") || value.startsWith("mailto") ? value : `https://${value}`} target="_blank" rel="noreferrer" className="text-sage hover:underline truncate">
          {value}
        </a>
      ) : (
        <span className="text-charcoal/40 italic">—</span>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <>
      <div className="rounded-2xl border border-sage/15 bg-white p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr_auto] md:items-center">
          <Skeleton className="size-24 rounded-full bg-sage/10" />
          <div className="space-y-2 min-w-0">
            <Skeleton className="h-3 w-32 bg-sage/10" />
            <Skeleton className="h-8 w-56 bg-sage/15" />
            <Skeleton className="h-4 w-40 bg-sage/10" />
            <Skeleton className="h-4 w-48 bg-sage/10" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-6 w-24 bg-sage/10" />
            <Skeleton className="h-8 w-24 bg-sage/10" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-2xl shadow-xs">
            <CardHeader><Skeleton className="h-5 w-32 bg-sage/10" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full bg-sage/10" />
              <Skeleton className="h-4 w-5/6 bg-sage/10" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
