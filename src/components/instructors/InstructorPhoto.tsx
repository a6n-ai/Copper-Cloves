import Image from "next/image";
import { supportsResponsivePicture } from "@/lib/imageDelivery";
import { BLUR_DATA_URL, isUnoptimizableSrc } from "@/lib/imageBlur";
import { instructorObjectPositionClass } from "@/lib/instructorView";

/**
 * Fill-mode instructor photo. The parent must be `relative` and own the shape
 * (aspect ratio, rounding, `overflow-hidden`). Uses a responsive `<picture>`
 * for CDN-backed sources, falling back to `next/image` otherwise — same
 * delivery strategy the homepage carousel shipped with, now shared.
 */
export function InstructorPhoto({
  src,
  name,
  sizes,
  priority = false,
  className = "",
  onLoad,
  onError,
}: {
  src: string;
  name: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const pos = instructorObjectPositionClass(name);
  const imgClass = `h-full w-full object-cover ${pos} ${className}`;

  if (supportsResponsivePicture(src)) {
    return (
      <picture>
        <source
          srcSet={`${src}?format=webp&width=320 320w, ${src}?format=webp&width=640 640w, ${src}?format=webp&width=1200 1200w`}
          sizes={sizes}
          type="image/webp"
        />
        <source
          srcSet={`${src}?width=320 320w, ${src}?width=640 640w, ${src}?width=1200 1200w`}
          sizes={sizes}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`${name}, instructor at The Studio by Copper + Cloves`}
          loading={priority ? "eager" : "lazy"}
          onLoad={onLoad}
          onError={onError}
          className={imgClass}
        />
      </picture>
    );
  }

  return (
    <Image
      src={src}
      alt={`${name}, instructor at The Studio by Copper + Cloves`}
      fill
      sizes={sizes}
      priority={priority}
      placeholder="blur"
      blurDataURL={BLUR_DATA_URL}
      unoptimized={isUnoptimizableSrc(src)}
      onLoad={onLoad}
      onError={onError}
      className={imgClass}
    />
  );
}
