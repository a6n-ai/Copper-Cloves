import type { CSSProperties } from "react";
import { DEFAULT_PALETTE, type MeshPalette } from "@/lib/weatherPalette";

/**
 * Animated mesh-gradient backdrop for the auth pages (/login, /portal/signup).
 * Colors come from `palette` (time-of-day / weather driven). Pure CSS keyframes
 * on transform / opacity / background-position → GPU-cheap, no canvas, no extra
 * deps. Respects prefers-reduced-motion (animations freeze).
 */
export function AuthMeshBackground({
  className = "",
  palette = DEFAULT_PALETTE,
}: {
  className?: string;
  palette?: MeshPalette;
}) {
  const vars = {
    "--mesh-c1": palette.c1,
    "--mesh-c2": palette.c2,
    "--mesh-c3": palette.c3,
    "--mesh-c4": palette.c4,
    "--mesh-from": palette.baseFrom,
    "--mesh-to": palette.baseTo,
  } as CSSProperties;

  return (
    <div aria-hidden style={vars} className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Shifting base mesh */}
      <div className="auth-mesh absolute inset-[-25%]" />

      {/* Floating brand blobs — one per palette color, for a prominent multi-tone wash */}
      <div className="auth-blob blob-c1 absolute h-[44rem] w-[44rem] rounded-full blur-3xl" />
      <div className="auth-blob blob-c2 absolute h-[40rem] w-[40rem] rounded-full blur-3xl" />
      <div className="auth-blob blob-c3 absolute h-[36rem] w-[36rem] rounded-full blur-3xl" />
      <div className="auth-blob blob-c4 absolute h-[32rem] w-[32rem] rounded-full blur-3xl" />

      <style jsx>{`
        .auth-mesh {
          background:
            radial-gradient(circle at 18% 22%, var(--mesh-c1) 0, transparent 38%),
            radial-gradient(circle at 82% 18%, var(--mesh-c2) 0, transparent 40%),
            radial-gradient(circle at 72% 82%, var(--mesh-c3) 0, transparent 42%),
            radial-gradient(circle at 22% 80%, var(--mesh-c4) 0, transparent 40%),
            linear-gradient(135deg, var(--mesh-from) 0%, var(--mesh-to) 100%);
          background-size: 200% 200%;
          animation: auth-mesh-shift 22s ease-in-out infinite alternate;
          will-change: background-position;
        }

        .auth-blob {
          opacity: 0.85;
          will-change: transform;
          mix-blend-mode: multiply;
        }
        .blob-c1 {
          top: -10rem;
          left: -8rem;
          background: radial-gradient(circle, var(--mesh-c1), transparent 68%);
          animation: auth-float-a 19s ease-in-out infinite alternate;
        }
        .blob-c2 {
          top: -6rem;
          right: -8rem;
          background: radial-gradient(circle, var(--mesh-c2), transparent 68%);
          animation: auth-float-b 24s ease-in-out infinite alternate;
        }
        .blob-c3 {
          bottom: -10rem;
          right: -4rem;
          background: radial-gradient(circle, var(--mesh-c3), transparent 68%);
          animation: auth-float-c 27s ease-in-out infinite alternate;
        }
        .blob-c4 {
          bottom: -8rem;
          left: 30%;
          background: radial-gradient(circle, var(--mesh-c4), transparent 68%);
          animation: auth-float-a 30s ease-in-out infinite alternate-reverse;
        }

        @keyframes auth-mesh-shift {
          0% { background-position: 0% 0%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 50% 100%; }
        }
        @keyframes auth-float-a {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          100% { transform: translate3d(9rem, 7rem, 0) scale(1.18); }
        }
        @keyframes auth-float-b {
          0% { transform: translate3d(0, 0, 0) scale(1.1); }
          100% { transform: translate3d(-8rem, 6rem, 0) scale(0.92); }
        }
        @keyframes auth-float-c {
          0% { transform: translate3d(0, 0, 0) scale(0.95); }
          100% { transform: translate3d(-7rem, -5rem, 0) scale(1.22); }
        }

        @media (prefers-reduced-motion: reduce) {
          .auth-mesh,
          .auth-blob {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
