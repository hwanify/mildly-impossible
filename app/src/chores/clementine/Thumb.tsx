import { useEffect, useRef } from "react";
import { W, demoPeel } from "./engine";

// A still of the game itself: a calm spiral peel, about half way round.
export function ClementineThumb() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const g = demoPeel(20261006, 0.42);
    const sc = canvas.width / W;
    const z = 1.3;
    const [cx, cy] = [400, 318];
    ctx.setTransform(sc * z, 0, 0, sc * z, sc * (W / 2 - cx * z), sc * (320 - cy * z));
    g.draw(ctx);
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}
