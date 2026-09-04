import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCheckinScan, formatClassTime } from "@/lib/useCheckinScan";

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
  const { state, submit, confirmWalkIn, cancel, fail } = useCheckinScan();
  const msg =
    state.kind === "done"
      ? { ok: true, text: state.text }
      : state.kind === "error"
        ? { ok: false, text: state.text }
        : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-charcoal">Scan to check in</DialogTitle>
        </DialogHeader>
        {state.kind === "confirm" ? (
          <div className="space-y-4 font-body text-sm text-charcoal">
            <p className="font-medium">
              You’re not booked for {state.prompt.className} ·{" "}
              {formatClassTime(state.prompt.startTime)}
            </p>
            {state.prompt.intended ? (
              <p className="text-muted-text">
                Your booking today is {state.prompt.intended.className} at{" "}
                {formatClassTime(state.prompt.intended.startTime)}. If that’s the class you
                attended, ask the desk to mark you in.
              </p>
            ) : null}
            <p className="text-muted-text">
              {state.prompt.costsCredit
                ? "Join as a walk-in? This uses 1 class credit."
                : "Join as a walk-in on your unlimited pass?"}
            </p>
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={confirmWalkIn}>
                Yes, join
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  cancel();
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : msg ? (
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
                if (state.kind === "busy") return;
                const raw = codes?.[0]?.rawValue;
                if (!raw) return;
                const token = extractToken(raw);
                if (token) void submit(token);
              }}
              onError={() =>
                fail("Camera unavailable — allow camera access or open in your browser.")
              }
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
