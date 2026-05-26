import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/quick-actions";

interface ActiveSchedule {
  scheduleId: string;
  className: string;
  instructorName: string | null;
  startTime: string;
  instructorCheckedIn: boolean;
  instructorQrUrl: string | null;
  memberQrUrl: string | null;
}

export function CheckinQrDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [data, setData] = useState<ActiveSchedule | null>(null);
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const r = await fetch("/api/admin/active-checkin-schedule");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled) setData(d.active);
    };
    load();
    const id = setInterval(load, 15000);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [open]);

  const validUntil = data
    ? new Date(new Date(data.startTime).getTime() + 30 * 60000).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">
              {data ? `Check-in — ${data.className}` : "Check-in"}
            </DialogTitle>
          </DialogHeader>
          {!data ? (
            <p className="py-12 text-center text-charcoal/60">No class is currently open for check-in.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Instructor half */}
              <div className="flex flex-col items-center gap-3 rounded-xl border border-sage/15 p-6">
                <p className="font-display text-lg text-charcoal">Instructor</p>
                {data.instructorCheckedIn ? (
                  <div className="flex h-[240px] w-[240px] flex-col items-center justify-center gap-2 text-sage">
                    <CheckCircle2 size={48} />
                    <span className="font-body text-sm">Checked in</span>
                  </div>
                ) : data.instructorQrUrl ? (
                  <QrTile
                    url={data.instructorQrUrl}
                    alt="Instructor check-in QR"
                    onZoom={() => setZoom({ url: data.instructorQrUrl!, label: "Instructor check-in" })}
                    caption={`${data.instructorName ?? "Instructor"} — tap to enlarge`}
                  />
                ) : (
                  <p className="flex h-[240px] items-center text-center text-sm text-charcoal/50">QR unavailable (S3 not configured)</p>
                )}
              </div>
              {/* Member half */}
              <div className="flex flex-col items-center gap-3 rounded-xl border border-sage/15 p-6">
                <p className="font-display text-lg text-charcoal">Members</p>
                {data.memberQrUrl ? (
                  <QrTile
                    url={data.memberQrUrl}
                    alt="Member check-in QR"
                    onZoom={() => setZoom({ url: data.memberQrUrl!, label: "Member check-in" })}
                    caption={`Valid until ${validUntil} — tap to enlarge`}
                  />
                ) : (
                  <p className="flex h-[240px] items-center text-center text-sm text-charcoal/50">QR unavailable (S3 not configured)</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen QR for easy scanning across the room */}
      {zoom ? (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-white p-6"
          onClick={() => setZoom(null)}
          role="dialog"
          aria-label={zoom.label}
        >
          <CloseButton
            onClick={() => setZoom(null)}
            className="absolute right-5 top-5 rounded-full text-charcoal/60"
          />
          <p className="font-display text-3xl text-charcoal">{zoom.label}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom.url}
            alt={zoom.label}
            className="h-auto w-auto max-h-[75vh] max-w-[75vw] rounded-2xl"
          />
          <p className="font-body text-sm text-charcoal/50">Tap anywhere to close</p>
        </div>
      ) : null}
    </>
  );
}

function QrTile({
  url,
  alt,
  caption,
  onZoom,
}: {
  url: string;
  alt: string;
  caption: string;
  onZoom: () => void;
}) {
  return (
    <button type="button" onClick={onZoom} className="group flex flex-col items-center gap-2">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} width={240} height={240} className="rounded-lg" />
        <span className="absolute right-2 top-2 rounded-full bg-charcoal/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Maximize2 size={16} />
        </span>
      </div>
      <p className="text-xs text-charcoal/50">{caption}</p>
    </button>
  );
}
