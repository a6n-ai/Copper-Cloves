import { useState } from "react";
import Image from "next/image";
import { Maximize2 } from "lucide-react";
import { CloseButton } from "@/components/ui/quick-actions";

/** A QR image that opens fullscreen on click for easy scanning across a room. */
export function QrZoomImage({
  url,
  label,
  caption,
  size = 220,
}: {
  url: string;
  label: string;
  caption?: string;
  size?: number;
}) {
  const [zoom, setZoom] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setZoom(true)} className="group flex flex-col items-center gap-2">
        <div className="relative">
          <Image src={url} alt={label} width={size} height={size} className="rounded-lg" unoptimized />
          <span className="absolute right-2 top-2 rounded-full bg-charcoal/60 p-1.5 text-cream opacity-0 transition-opacity group-hover:opacity-100">
            <Maximize2 size={16} />
          </span>
        </div>
        {caption ? <p className="text-xs text-charcoal/50">{caption}</p> : null}
      </button>

      {zoom ? (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-white-warm p-6"
          onClick={() => setZoom(false)}
          role="dialog"
          aria-label={label}
        >
          <CloseButton
            onClick={() => setZoom(false)}
            className="absolute right-5 top-5 rounded-full text-charcoal/60"
          />
          <p className="font-display text-3xl text-charcoal">{label}</p>
          <Image
            src={url}
            alt={label}
            width={800}
            height={800}
            className="h-auto w-auto max-h-[75vh] max-w-[75vw] rounded-2xl"
            unoptimized
          />
          <p className="font-body text-sm text-charcoal/50">Tap anywhere to close</p>
        </div>
      ) : null}
    </>
  );
}
