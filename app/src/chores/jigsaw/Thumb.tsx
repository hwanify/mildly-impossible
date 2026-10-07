import { useEffect, useRef } from "react";
import { drawBoard } from "./engine";
import { highStreet } from "./pictures/highStreet";
import { BW, BH, makeCut, startBoard } from "./puzzle";

// A still of the first jigsaw about half done, drawn by the game itself.
export function JigsawThumb() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      const s = Math.min(canvas.width / (BW + 80), canvas.height / (BH + 80));
      const pic = document.createElement("canvas");
      pic.width = Math.round(BW * s * 1.5);
      pic.height = Math.round(BH * s * 1.5);
      const pc = pic.getContext("2d")!;
      pc.scale(s * 1.5, s * 1.5);
      highStreet.draw(pc);
      ctx.fillStyle = "#ECE7DD";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(s, 0, 0, s, (canvas.width - BW * s) / 2, (canvas.height - BH * s) / 2);
      drawBoard(ctx, pic, s * 1.5, startBoard(highStreet.landmarks, 150, 1), makeCut(1001));
    });
    return () => {
      alive = false;
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}
