import { useEffect, useRef } from "react";
import { Sticker, W } from "./engine";

// A still from the game itself: the sticker about a third of the way off.
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
      const s = new Sticker(11);
      s.pose(150, 96);
      const sc = canvas.width / W;
      const z = 2;
      const [cx, cy] = [470, 378];
      ctx.setTransform(sc * z, 0, 0, sc * z, sc * (W / 2 - cx * z), sc * (320 - cy * z));
      s.draw(ctx);
    };
    draw();
    document.fonts?.ready.then(draw);
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}
