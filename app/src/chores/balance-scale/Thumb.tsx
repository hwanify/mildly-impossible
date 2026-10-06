import { useEffect, useRef } from "react";
import { Balance, W } from "./engine";

// A still from the game: a whale against a house and a couple of people, nearly but not quite.
export function Thumb() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      const b = new Balance(5);
      b.add(0, "whale", 1.42e8);
      b.add(0, "cat", 4200);
      b.add(1, "house", 1.31e8);
      b.add(1, "person", 70000);
      b.add(1, "person", 81000);
      b.add(1, "ant", 0.003);
      b.settle();
      const sc = canvas.width / W;
      const z = 1.12;
      ctx.setTransform(sc * z, 0, 0, sc * z, sc * (W / 2 - 500 * z), sc * (320 - 300 * z));
      b.draw(ctx, { tray: false });
    };
    draw();
    document.fonts?.ready.then(draw);
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}
