import { useState } from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((m) => m.Scanner),
  { ssr: false },
);

function extractToken(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.searchParams.get("t");
  } catch {
    return raw || null; // raw token fallback
  }
}

export function ScanCheckInModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(token: string) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/checkin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setMsg({ ok: true, text: d.status === "already" ? "Already checked in ✓" : "Checked in ✓" });
      else setMsg({ ok: false, text: typeof d.error === "string" ? d.error : "Check-in failed" });
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-charcoal">Scan to check in</DialogTitle>
        </DialogHeader>
        {msg ? (
          <div
            className={`rounded-lg p-4 text-center font-body text-sm ${
              msg.ok ? "bg-sage/10 text-sage" : "bg-[#a05e38]/10 text-[#a05e38]"
            }`}
          >
            {msg.text}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl">
            <Scanner
              onScan={(codes) => {
                const raw = codes?.[0]?.rawValue;
                if (!raw) return;
                const token = extractToken(raw);
                if (token) void submit(token);
              }}
              onError={() =>
                setMsg({ ok: false, text: "Camera unavailable — allow camera access or open in your browser." })
              }
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
