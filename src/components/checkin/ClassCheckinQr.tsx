import { QrZoomImage } from "@/components/checkin/QrZoomImage";

type Kind = "member" | "instructor";

export type ClassCheckinQrData = {
  memberQrUrl?: string | null;
  instructorQrUrl?: string | null;
  withinWindow?: boolean;
  windowOpensAt?: string | null;
};

interface Props {
  kind: Kind;
  qr: ClassCheckinQrData | null | undefined;
  size?: number;
  /** Label shown above the QR ("Instructor" / "Members" by default). */
  label?: string;
}

/**
 * Single source of truth for rendering a class check-in QR. Decides between
 * three states based on the schedule-qr payload:
 *   1. Live QR (within window + url present) → zoomable QR image
 *   2. Pre-window (window opens later) → blurred fake QR with countdown caption
 *   3. Unavailable (post-window or no url) → terse placeholder text
 */
export function ClassCheckinQr({ kind, qr, size = 200, label }: Props) {
  const url = kind === "instructor" ? qr?.instructorQrUrl : qr?.memberQrUrl;
  const heading = label ?? (kind === "instructor" ? "Instructor" : "Members");
  const preWindow = !qr?.withinWindow && !!qr?.windowOpensAt;
  const live = !!url && !!qr?.withinWindow;

  if (live) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="font-display text-base text-charcoal">{heading}</p>
        <QrZoomImage url={url!} label={`${heading} check-in`} caption="Tap to enlarge" size={size} />
      </div>
    );
  }

  if (preWindow) {
    const opens = qr!.windowOpensAt
      ? new Date(qr!.windowOpensAt!).toLocaleTimeString(undefined, { timeStyle: "short" })
      : "later";
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="font-display text-base text-charcoal">{heading}</p>
        <BlurredFakeQr caption={opens} size={size} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="font-display text-base text-charcoal">{heading}</p>
      <div
        className="flex items-center justify-center rounded-md border border-sage/15 bg-cream/30 text-center"
        style={{ width: size, height: size }}
      >
        <p className="px-3 font-body text-xs text-charcoal/55">QR not available</p>
      </div>
    </div>
  );
}

function BlurredFakeQr({ caption, size }: { caption: string; size: number }) {
  // 13x13 pseudo-QR: three finder squares + sparse deterministic dots.
  const grid = 13;
  const isFinder = (r: number, c: number) => {
    const inBox = (br: number, bc: number) => r >= br && r <= br + 6 && c >= bc && c <= bc + 6;
    const onRing = (br: number, bc: number) => r === br || r === br + 6 || c === bc || c === bc + 6;
    const inCenter = (br: number, bc: number) => r >= br + 2 && r <= br + 4 && c >= bc + 2 && c <= bc + 4;
    const corners: [number, number][] = [[0, 0], [0, grid - 7], [grid - 7, 0]];
    return corners.some(([br, bc]) => inBox(br, bc) && (onRing(br, bc) || inCenter(br, bc)));
  };
  const cells = Array.from({ length: grid * grid }, (_, i) => {
    const r = Math.floor(i / grid);
    const c = i % grid;
    if (isFinder(r, c)) return true;
    return (r * 31 + c * 17 + r * c) % 5 === 0;
  });
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className="grid h-full w-full gap-[2px] rounded-md bg-white p-2 blur-[3px]"
        style={{ gridTemplateColumns: `repeat(${grid}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {cells.map((on, i) => (
          <div key={i} className={on ? "bg-charcoal" : "bg-transparent"} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-md bg-cream/50 px-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-charcoal/70">QR opens in</p>
        <p className="mt-0.5 font-display text-sm text-charcoal">{caption}</p>
      </div>
    </div>
  );
}

export default ClassCheckinQr;
