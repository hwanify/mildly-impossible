import { useEffect, useRef } from "react";
import { Pizza, W } from "./engine";

// A still of a pizza that was cut with confidence, drawn by the game itself.
export function PizzaThumb() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const p = new Pizza(20261006);
    p.cut({ x: 230, y: 330 }, { x: 770, y: 306 });
    p.cut({ x: 512, y: 50 }, { x: 488, y: 600 });
    p.cut({ x: 300, y: 128 }, { x: 712, y: 528 });
    p.settle();
    const sc = canvas.width / W;
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    p.draw(ctx);
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}
