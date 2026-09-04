import { useCallback, useState } from "react";

export interface WalkInPrompt {
  className: string;
  startTime: string;
  costsCredit: boolean;
  /** The booking the member probably meant — their own class in the ±3h window. */
  intended: { bookingId: string; scheduleId: string; className: string; startTime: string } | null;
}

export type ScanState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; text: string }
  | { kind: "error"; text: string }
  | { kind: "confirm"; token: string; prompt: WalkInPrompt };

/**
 * Shared driver for POST /api/checkin/scan. A 409 means "you are not booked for
 * the scanned class" — the caller must show `prompt` and only then call
 * `confirmWalkIn()`, so a stale QR can never spend a credit on its own.
 */
export function useCheckinScan() {
  const [state, setState] = useState<ScanState>({ kind: "idle" });

  const submit = useCallback(async (token: string, confirm = false) => {
    setState({ kind: "busy" });
    try {
      const r = await fetch("/api/checkin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirm ? { token, confirm: true } : { token }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409 && d?.needsWalkInConfirm) {
        setState({ kind: "confirm", token, prompt: d as WalkInPrompt });
        return;
      }
      if (r.ok) {
        setState({
          kind: "done",
          text: d.status === "already" ? "Already checked in ✓" : "Checked in ✓",
        });
        return;
      }
      setState({ kind: "error", text: typeof d.error === "string" ? d.error : "Check-in failed" });
    } catch {
      setState({ kind: "error", text: "Network error" });
    }
  }, []);

  const confirmWalkIn = useCallback(() => {
    if (state.kind !== "confirm") return;
    void submit(state.token, true);
  }, [state, submit]);

  const cancel = useCallback(() => setState({ kind: "idle" }), []);
  const fail = useCallback((text: string) => setState({ kind: "error", text }), []);

  return { state, submit, confirmWalkIn, cancel, fail };
}

export function formatClassTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
