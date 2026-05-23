import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { DEFAULT_PALETTE, type MeshPalette } from "@/lib/weatherPalette";

/**
 * Constellation-network backdrop for the auth pages: drifting dots connected by
 * thin lines that link/unlink as they move. Canvas-based (lines are redrawn each
 * frame). Palette-driven, so weather/time-of-day still tints it. Same
 * `{ palette }` contract as the other auth backgrounds — drop-in swap.
 * Honors prefers-reduced-motion (renders a single static frame, no loop).
 */

function rgb(color: string): [number, number, number] {
  const m = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [143, 151, 121];
}

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: [number, number, number];
}

const LINK_DIST = 140;
const SPEED = 0.25;

export function AuthNetworkBackground({
  className = "",
  palette = DEFAULT_PALETTE,
}: {
  className?: string;
  palette?: MeshPalette;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dotColors = [rgb(palette.c1), rgb(palette.c2), rgb(palette.c3)];
    const lineColor = rgb(palette.c3);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let dots: Dot[] = [];
    let raf = 0;
    let w = 0;
    let h = 0;

    function seed() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(90, Math.max(28, Math.round((w * h) / 14000)));
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * SPEED * 2,
        vy: (Math.random() - 0.5) * SPEED * 2,
        r: 1.2 + Math.random() * 2.2,
        c: dotColors[Math.floor(Math.random() * dotColors.length)],
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      // links
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DIST) {
            const a = (1 - dist / LINK_DIST) * 0.4;
            ctx!.strokeStyle = `rgba(${lineColor[0]}, ${lineColor[1]}, ${lineColor[2]}, ${a})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(dots[i].x, dots[i].y);
            ctx!.lineTo(dots[j].x, dots[j].y);
            ctx!.stroke();
          }
        }
      }
      // dots
      for (const d of dots) {
        ctx!.fillStyle = `rgba(${d.c[0]}, ${d.c[1]}, ${d.c[2]}, 0.85)`;
        ctx!.beginPath();
        ctx!.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function step() {
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;
      }
      draw();
      raf = requestAnimationFrame(step);
    }

    seed();
    if (reduced) draw();
    else step();

    const onResize = () => {
      seed();
      if (reduced) draw();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [palette]);

  const style = { backgroundColor: palette.baseTo } as CSSProperties;

  return (
    <div aria-hidden style={style} className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
