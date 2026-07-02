import { useEffect, useMemo, useRef, useState } from "react";
import { mutate } from "swr";
import { useStudioSWR } from "@/lib/swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, PauseCircle, Paperclip, Calendar as CalendarIcon, Ticket } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addHours, differenceInCalendarDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";

interface SupportTicket {
  type: string;
  status: string;
  user_package_id: string | null;
}

interface ActivePackage {
  id: string;
  pass_type: string | null;
  credits_remaining: number | null;
  expiration_date: string;
  package_type?: { name?: string | null } | null;
}

function passLabel(p: ActivePackage): string {
  const name = p.package_type?.name?.trim() || (p.pass_type === "studio_pass" ? "Studio Pass" : "Class Pass");
  const kind = p.pass_type === "studio_pass" ? "Unlimited" : p.credits_remaining != null ? `${p.credits_remaining} left` : "";
  const expiry = `exp ${format(new Date(p.expiration_date), "d MMM yyyy")}`;
  return [name, kind, expiry].filter(Boolean).join(" · ");
}

/**
 * Member pause-subscription request form. The member picks which active pass to
 * pause; the chosen `user_package_id` rides along so admin-resolve freezes that
 * exact pass. A pass that already has a pending request is shown disabled.
 */
export function PauseSubscriptionCard() {
  const { toast } = useToast();
  const attachmentRef = useRef<HTMLInputElement>(null);

  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [pauseReason, setPauseReason] = useState("");
  const [pauseRange, setPauseRange] = useState<DateRange | undefined>(undefined);
  const minPauseStart = (() => { const d = addHours(new Date(), 72); d.setHours(0, 0, 0, 0); return d; })();
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentName, setAttachmentName] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);

  const { data: ticketData } = useStudioSWR<SupportTicket[]>("/api/user/support-tickets");
  const { data: packageData, isLoading: packagesLoading } =
    useStudioSWR<ActivePackage[]>("/api/user-packages?active=true");

  const activePackages = useMemo(() => (Array.isArray(packageData) ? packageData : []), [packageData]);
  const pendingPackageIds = useMemo(
    () => new Set(
      (Array.isArray(ticketData) ? ticketData : [])
        .filter((t) => t.type === "pause_subscription" && ["open", "in_review"].includes(t.status) && t.user_package_id)
        .map((t) => t.user_package_id as string),
    ),
    [ticketData],
  );
  const selectablePackages = useMemo(
    () => activePackages.filter((p) => !pendingPackageIds.has(p.id)),
    [activePackages, pendingPackageIds],
  );

  // Auto-select when exactly one pass is selectable; clear a selection that
  // becomes pending after a successful submit.
  useEffect(() => {
    if (selectedPackageId && pendingPackageIds.has(selectedPackageId)) {
      setSelectedPackageId("");
      return;
    }
    if (!selectedPackageId && selectablePackages.length === 1) {
      setSelectedPackageId(selectablePackages[0].id);
    }
  }, [selectablePackages, selectedPackageId, pendingPackageIds]);

  async function onAttachmentSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAttachmentUploading(true);
    try {
      const presignRes = await fetch("/api/user/avatar-presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, purpose: "doc" }),
      });
      const presignJson = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok) {
        toast({ title: "Upload unavailable", description: presignJson.error ?? "Try again later.", variant: "destructive" });
        return;
      }
      const { uploadUrl, publicUrl } = presignJson as { uploadUrl?: string; publicUrl?: string };
      if (!uploadUrl || !publicUrl) { toast({ title: "Upload error", variant: "destructive" }); return; }
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setAttachmentUrl(publicUrl);
      setAttachmentName(file.name);
      toast({ title: "Document uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setAttachmentUploading(false);
    }
  }

  async function submitPauseTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPackageId) { toast({ title: "Please select which pass to pause", variant: "destructive" }); return; }
    if (!pauseReason.trim()) { toast({ title: "Please describe your reason", variant: "destructive" }); return; }
    if (!pauseRange?.from || !pauseRange?.to) { toast({ title: "Please select pause dates", variant: "destructive" }); return; }
    if (pauseRange.from < minPauseStart) {
      toast({ title: "Start date must be at least 72 hours from now", variant: "destructive" });
      return;
    }
    setSubmittingTicket(true);
    try {
      const res = await fetch("/api/user/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "pause_subscription",
          reason: pauseReason,
          user_package_id: selectedPackageId,
          attachment_url: attachmentUrl || undefined,
          pause_from: pauseRange.from.toISOString(),
          pause_to: pauseRange.to.toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast({ title: "Submission failed", description: data.error ?? "Try again.", variant: "destructive" }); return; }
      setSelectedPackageId("");
      setPauseReason("");
      setPauseRange(undefined);
      setAttachmentUrl("");
      setAttachmentName("");
      // Surface the new pending request + lock the chosen pass in the selector.
      await Promise.all([
        mutate("/api/user/support-tickets"),
        mutate("/api/user-packages?active=true"),
      ]);
      toast({ title: "Request submitted", description: "We'll review and get back to you soon." });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmittingTicket(false);
    }
  }

  const noActivePasses = !packagesLoading && activePackages.length === 0;
  const allPending = !packagesLoading && activePackages.length > 0 && selectablePackages.length === 0;

  return (
    <Card className="border-sage/20 bg-[#fafaf8]/90">
      <CardHeader className="p-6 border-b border-sage/10 bg-linear-to-r from-cream/50 to-[#fafaf8]">
        <CardTitle className="font-display text-xl text-charcoal flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-terracotta/10 flex items-center justify-center">
            <PauseCircle className="text-terracotta" size={20} />
          </div>
          Pause Subscription
        </CardTitle>
        <CardDescription className="font-body text-charcoal/60 mt-1">
          Raise a request to pause an active pass — we&apos;ll review and respond within 24 hours
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {packagesLoading ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <div className="space-y-2">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ) : noActivePasses ? (
          <Alert className="border-sage/30 bg-sage/5">
            <CheckCircle2 className="h-5 w-5 text-sage" />
            <AlertDescription className="font-body text-charcoal ml-2">
              You don&apos;t have an active pass to pause right now.
            </AlertDescription>
          </Alert>
        ) : allPending ? (
          <Alert className="border-sage/30 bg-sage/5">
            <CheckCircle2 className="h-5 w-5 text-sage" />
            <AlertDescription className="font-body text-charcoal ml-2">
              You already have a pending pause request for each active pass. Our team will reach out soon.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={submitPauseTicket} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label className="font-body text-sm text-charcoal flex items-center gap-2">
                <Ticket size={13} className="text-sage" />
                Which pass? <span className="text-terracotta">*</span>
              </Label>
              <div className="space-y-2">
                {activePackages.map((p) => {
                  const pending = pendingPackageIds.has(p.id);
                  const selected = selectedPackageId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={pending}
                      onClick={() => setSelectedPackageId(p.id)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-left font-body text-sm transition-all ${
                        pending
                          ? "border-charcoal/10 bg-charcoal/5 text-charcoal/40 cursor-not-allowed"
                          : selected
                            ? "border-sage bg-sage/10 text-charcoal"
                            : "border-sage/20 bg-white-warm text-charcoal/80 hover:border-sage/40"
                      }`}
                    >
                      <span>{passLabel(p)}</span>
                      {pending
                        ? <span className="text-[11px] shrink-0">Request pending</span>
                        : selected && <CheckCircle2 size={16} className="text-sage shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-sm text-charcoal flex items-center gap-2">
                <CalendarIcon size={13} className="text-sage" />
                Pause dates <span className="text-terracotta">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline"
                    className="w-full justify-start text-left font-body text-sm border-sage/20 hover:bg-sage/5 h-11 hover:text-sage!">
                    {pauseRange?.from && pauseRange?.to ? (
                      <>
                        {format(pauseRange.from, "d MMM yyyy")} → {format(pauseRange.to, "d MMM yyyy")}
                        <span className="ml-auto text-xs text-charcoal/50">
                          {differenceInCalendarDays(pauseRange.to, pauseRange.from) + 1} day{differenceInCalendarDays(pauseRange.to, pauseRange.from) === 0 ? "" : "s"}
                        </span>
                      </>
                    ) : (
                      <span className="text-charcoal/50">Select start and end dates</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    selected={pauseRange}
                    onSelect={setPauseRange}
                    disabled={{ before: minPauseStart }}
                    defaultMonth={minPauseStart}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-charcoal/50 font-body">
                Start date must be at least 72 hours from now. Earliest available: {format(minPauseStart, "d MMM yyyy")}.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-sm text-charcoal">Reason for pausing <span className="text-terracotta">*</span></Label>
              <Textarea value={pauseReason} onChange={(e) => setPauseReason(e.target.value)}
                placeholder="E.g. travelling for 3 weeks, recovering from injury, etc. The more detail, the faster we can help…"
                className="border-sage/20 focus:border-sage focus-visible:ring-2 focus-visible:ring-sage/30 font-body text-sm resize-none" rows={4} required />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-sm text-charcoal flex items-center gap-2">
                <Paperclip size={13} className="text-sage" /> Supporting Document
                <span className="text-xs text-charcoal/40 font-normal">(optional)</span>
              </Label>
              <input ref={attachmentRef} type="file"
                accept="image/*,application/pdf,.doc,.docx"
                disabled={attachmentUploading}
                onChange={(ev) => void onAttachmentSelected(ev)} className="hidden" />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm"
                  disabled={attachmentUploading}
                  onClick={() => attachmentRef.current?.click()}
                  className="border-sage/30 text-sage hover:bg-sage hover:text-cream font-body text-xs h-9">
                  {attachmentUploading ? "Uploading…" : "Upload file"}
                </Button>
                {attachmentName && (
                  <span className="font-body text-xs text-charcoal/60 truncate max-w-[200px] flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-sage shrink-0" />
                    {attachmentName}
                  </span>
                )}
              </div>
              <p className="text-xs text-charcoal/40 font-body">Doctor&apos;s note, travel itinerary, etc. PDF, image, or Word doc.</p>
            </div>
            <Button type="submit"
              disabled={submittingTicket || !selectedPackageId || !pauseReason.trim() || !pauseRange?.from || !pauseRange?.to}
              variant="terracotta" className="w-full h-12">
              {submittingTicket ? <><Spinner className="mr-2 size-4" />Submitting…</> : "Submit Pause Request"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
