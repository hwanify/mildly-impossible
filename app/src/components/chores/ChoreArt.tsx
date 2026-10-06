import { useEffect, useRef } from "react";
import { Sheet, W, H } from "../../game/fittedSheet";

const STROKE = { fill: "none", stroke: "#8A877F", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

// A real, still frame of the fitted-sheet simulation (drawn client side only).
export function SheetThumb() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const sheet = new Sheet(20261006);
    const sc = canvas.width / W;
    ctx.setTransform(sc * 1.15, 0, 0, sc * 1.15, -W * sc * 0.075, -H * sc * 0.075);
    sheet.draw(ctx, -1);
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}

export function TapeArt() {
  return (
    <svg viewBox="0 0 200 128" aria-hidden="true">
      <ellipse cx="100" cy="64" rx="44" ry="42" {...STROKE} />
      <ellipse cx="100" cy="64" rx="21" ry="20" {...STROKE} />
      <ellipse cx="100" cy="64" rx="14" ry="13" {...STROKE} strokeDasharray="2 4" />
      <path d="M68 36c8-8 18-12 30-13" {...STROKE} opacity=".5" />
      <path d="M150 30l-6 6M156 44h-8M146 20l-2 8" {...STROKE} />
    </svg>
  );
}

export function DuvetArt() {
  return (
    <svg viewBox="0 0 200 128" aria-hidden="true">
      <path d="M50 26h92a8 8 0 0 1 8 8v60a8 8 0 0 1-8 8H50z" {...STROKE} />
      <path d="M150 34l-14-8" {...STROKE} />
      <path d="M50 26c-10 8-14 20-10 34s-2 30-12 40" {...STROKE} />
      <path d="M50 102c-8 2-16 0-22-2" {...STROKE} />
      <path d="M80 64c14-8 28 8 42 0s20-4 24 2" {...STROKE} opacity=".6" />
    </svg>
  );
}
