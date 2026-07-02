import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { DEFAULT_PALETTE, type MeshPalette } from "@/lib/weatherPalette";

/**
 * Drifting-leaves backdrop for the auth pages: botanical shapes slowly falling,
 * swaying side-to-side and rotating, over a SOLID tinted base. Palette-driven,
 * so weather/time-of-day still tints the leaves. Same `{ palette }` contract as
 * the other auth backgrounds — drop-in swap. Honors prefers-reduced-motion
 * (scatters a static set, no loop).
 */

function rgb(color: string): [number, number, number] {
  const m = /(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [143, 151, 121];
}

interface Leaf {
  x: number;
  y: number;
  size: number;
  rot: number;
  rotSpeed: number;
  fall: number;
  sway: number;
  swayAmp: number;
  swaySpeed: number;
  c: [number, number, number];
  alpha: number;
}

export function AuthLeavesBackground({
  className = "",
  palette = DEFAULT_PALETTE,
}: Readonly<{
  className?: string;
  palette?: MeshPalette;
}>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = [rgb(palette.c1), rgb(palette.c2), rgb(palette.c3)];
    const reduced = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let leaves: Leaf[] = [];
    let raf = 0;
    let w = 0;
    let h = 0;

    function makeLeaf(initial: boolean): Leaf {
      const size = 10 + Math.random() * 18;
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : -size - Math.random() * 80,
        size,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        fall: 0.25 + Math.random() * 0.6,
        sway: Math.random() * Math.PI * 2,
        swayAmp: 12 + Math.random() * 28,
        swaySpeed: 0.005 + Math.random() * 0.012,
        c: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.45 + Math.random() * 0.35,
      };
    }

    function seed() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(46, Math.max(16, Math.round((w * h) / 36000)));
      leaves = Array.from({ length: count }, () => makeLeaf(true));
    }

    function drawLeaf(l: Leaf, drawX: number) {
      const s = l.size;
      ctx.save();
      ctx.translate(drawX, l.y);
      ctx.rotate(l.rot);
      ctx.fillStyle = `rgba(${l.c[0]}, ${l.c[1]}, ${l.c[2]}, ${l.alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.62, -s * 0.1, 0, s);
      ctx.quadraticCurveTo(-s * 0.62, -s * 0.1, 0, -s);
      ctx.closePath();
      ctx.fill();
      // central vein
      ctx.strokeStyle = `rgba(${l.c[0]}, ${l.c[1]}, ${l.c[2]}, ${Math.min(1, l.alpha + 0.2)})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.85);
      ctx.lineTo(0, s * 0.85);
      ctx.stroke();
      ctx.restore();
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const l of leaves) {
        l.y += l.fall;
        l.sway += l.swaySpeed;
        l.rot += l.rotSpeed;
        const drawX = l.x + Math.sin(l.sway) * l.swayAmp;
        drawLeaf(l, drawX);
        if (l.y > h + l.size) Object.assign(l, makeLeaf(false));
      }
      raf = requestAnimationFrame(frame);
    }

    function drawStatic() {
      ctx.clearRect(0, 0, w, h);
      for (const l of leaves) drawLeaf(l, l.x);
    }

    seed();
    if (reduced) drawStatic();
    else frame();

    const onResize = () => {
      seed();
      if (reduced) drawStatic();
    };
    window.addEventListener("resize", onResize);

    const onVisibility = () => {
      if (reduced) return;
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [palette]);

  const style = { backgroundColor: palette.baseTo } as CSSProperties;

  return (
    <div aria-hidden style={style} className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
