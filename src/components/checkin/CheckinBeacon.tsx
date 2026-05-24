import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { CheckinQrDialog } from "@/components/checkin/CheckinQrDialog";

export function CheckinBeacon() {
  const [active, setActive] = useState<{ className: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch("/api/admin/active-checkin-schedule");
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (!cancelled) setActive(d.active ? { className: d.active.className } : null);
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = setInterval(poll, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!active) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-sage px-4 py-3 text-white shadow-lg transition-transform hover:scale-105"
      >
        <QrCode size={18} />
        <span className="font-body text-sm">Check-in live · {active.className}</span>
      </button>
      <CheckinQrDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
